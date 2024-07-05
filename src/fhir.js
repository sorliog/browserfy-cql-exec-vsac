const path = require('path');
const fetch = require('node-fetch');
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const { Code, ValueSet } = require('cql-execution');

/**
 * Asynchronously downloads a value set from VSAC using the provided API key, OID, version, and VSAC URL.
 * Populates the provided value set database (vsDB) with the downloaded value set.
 *
 * @param {string} apiKey - The API key for accessing VSAC.
 * @param {string} oid - The OID of the value set to download.
 * @param {string} version - The version of the value set to download.
 * @param {string} vsacUrl - The URL of the VSAC service.
 * @param {Object} vsDB - The value set database to populate with the downloaded value set.
 * @param {Object} options - Reserved for future use.
 */
async function downloadValueSet(
  apiKey,
  oid,
  version,
  vsacUrl,
  vsDB = {},
  options = {
    /* reserved for future use */
  },
) {
  const pages = await getValueSetPages(apiKey, oid, version, vsacUrl);
  if (pages == null || pages.length === 0) {
    return;
  }

  const id = pages[0].id;
  version = pages[0].version;
  const codes = [];
  pages.forEach(page => {
    if (page.expansion && page.expansion.contains) {
      codes.push(...page.expansion.contains.map(c => new Code(c.code, c.system, c.version)));
    }
  });
  vsDB[id] = {};
  vsDB[id][version] = new ValueSet(id, version, codes);

}

/**
 * Asynchronously retrieves all pages of a ValueSet expansion from the specified VSAC API.
 *
 * @param {string} apiKey - The API key for accessing the VSAC API.
 * @param {string} oid - The OID of the ValueSet.
 * @param {string} version - The version of the ValueSet.
 * @param {string} vsacUrl - The URL of the VSAC API.
 * @param {number} [offset=0] - The offset for pagination.
 * @returns {Promise<Array>} An array of all pages of the ValueSet expansion.
 */
async function getValueSetPages(apiKey, oid, version, vsacUrl, offset = 0, ) {
  const page = await getValueSet(apiKey, oid, version, vsacUrl ,offset);
  if (page && page.expansion) {
    const pTotal = page.expansion.total;
    const pOffset = page.expansion.offset;
    const pLength = page.expansion.contains && page.expansion.contains.length;
    if (pTotal != null && pOffset != null && pLength != null && pTotal > pOffset + pLength) {
      // Fetch and append the remaining value set pages
      const remainingPages = await getValueSetPages(apiKey, oid, version, vsacUrl, offset + pLength);
      return [page, ...remainingPages];
    } else {
      return [page];
    }
  }
}

/**
 * Asynchronously fetches a ValueSet from the specified VSAC URL using the provided API key, OID, version, and offset.
 *
 * @param {string} apiKey - The API key for authorization.
 * @param {string} oid - The OID of the ValueSet to fetch.
 * @param {string} version - The version of the ValueSet (optional).
 * @param {string} vsacUrl - The URL of the VSAC with '{{oid}}' as a placeholder for OID.
 * @param {number} offset - The offset for pagination (default is 0).
 * @returns {Promise} A Promise that resolves to the JSON response of the fetched ValueSet.
 * @throws {Error} If the response status is not ok.
 */
async function getValueSet(apiKey, oid, version, vsacUrl, offset = 0) {
  debug(
    `Getting ValueSet: ${oid}${version != null ? ` version ${version}` : ''} (offset: ${offset})`
  );
  const options = {
    headers: {
      Authorization: `Basic ${btoa(`apikey:${apiKey}`)}`
    }
  };
  const params = new URLSearchParams({ offset });

  if (version != null) {
    params.set('valueSetVersion', version);
  }

  const url = `${vsacUrl.replace('{{oid}}', oid)}?${params}`;
  debug(`Built Url ${url}`);

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(response.status);
  }
  return response.json();
}

module.exports = { name: 'FHIR', downloadValueSet };
