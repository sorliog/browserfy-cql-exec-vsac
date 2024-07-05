const path = require('path');
const fetch = require('node-fetch');
const parseString = require('xml2js').parseString;
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const { Code, ValueSet } = require('cql-execution');
const vsacCS = require('./vsac-code-systems');

/**
 * Asynchronously downloads a value set from VSAC using the provided API key, OID, and optional version.
 *
 * @param {string} apiKey - The API key for accessing the VSAC service.
 * @param {string} oid - The OID of the value set to be downloaded.
 * @param {string} version - The version of the value set to be downloaded (optional).
 * @param {string} vsacUrl - The URL of the VSAC service.
 * @param {object} vsDB - The object representing the valueset database.
 * @param {object} options - Additional options for downloading the value set (default: { svsCodeSystemType: 'url' }).
 *
 * @returns {Promise<void>} - A Promise that resolves once the value set is downloaded and parsed into the vsDB.
 */
async function downloadValueSet(
  apiKey,
  oid,
  version,
  vsacUrl,
  vsDB = {},
  options = { svsCodeSystemType: 'url' },
) {
  debug(`Getting ValueSet: ${oid}${version != null ? ` version ${version}` : ''}`);
  const params = new URLSearchParams({ id: oid });
  if (version != null) {
    params.append('version', version);
  }
  const requestOptions = {
    headers: {
      Authorization: `Basic ${btoa(`apikey:${apiKey}`)}`
    }
  };

  const url = `${vsacUrl}?${params}`;
  debug(`Built Url ${url}`);

  const response = await fetch(
    url,
    requestOptions
  );

  // console.log(response.text,response.status);
  if (!response.ok) {
    throw new Error(response.status);
  }
  const data = await response.text();
  parseVSACXML(data, vsDB, options);

}

/**
 * Retrieves the URI for a given code system from the provided codeSystems object.
 *
 * @param {Object} codeSystems - An object containing code systems and their URIs.
 * @param {string} system - The code system for which the URI needs to be retrieved.
 * @returns {Object|null} - Returns an object containing the URI for the code system if found, otherwise returns null.
 */
function getVSACCodeSystem(codeSystems, system) {
  if (
    typeof codeSystems[system] !== 'undefined' &&
    typeof codeSystems[system].uri !== 'undefined'
  ) {
    return codeSystems[system];
  }

  return null;
}


/**
 * Take in a string containing a string of the XML response from a VSAC SVS
 * response and parse it into a vsDB object. This code makes strong
 * assumptions about the structure of the message.
 *
 * @param {string} xmlString - The XML response string from VSAC SVS.
 * @param {Object} [vsDB={}] - The object to store the parsed data.
 * @param {Object} [options={ svsCodeSystemType: 'url' }] - Additional options for parsing.
 */
function parseVSACXML(xmlString, vsDB = {}, options = { svsCodeSystemType: 'url' }) {
  if (typeof xmlString === 'undefined' || xmlString == null || xmlString.trim().length == 0) {
    return;
  }
  // Parse the XML string.
  let parsedXML;
  parseString(xmlString, (err, res) => {
    parsedXML = res;
  });

  // Pull out the OID and version for this valueset.
  const vsOID = parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['$']['ID'];
  const vsVersion = parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['$']['version'];

  // Grab the list of codes.
  const conceptList =
    parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['ns0:ConceptList'][0][
      'ns0:Concept'
    ];

  // Loop over the codes and build the JSON.
  const codeList = [];
  for (let concept in conceptList) {
    let system = conceptList[concept]['$']['codeSystem'];
    const code = conceptList[concept]['$']['code'];
    const version = conceptList[concept]['$']['codeSystemVersion'];
    const systemOid = `urn:oid:${system}`;
    const systemUri = getVSACCodeSystem(vsacCS, system);

    if (options.svsCodeSystemType === 'oid') {
      // Keep the oid system as is
      system = systemOid;
    } else if (options.svsCodeSystemType === 'both') {
      // Optionally include both if they exist
      if (systemUri !== null) {
        codeList.push({ code, system: systemUri.uri, version });
      }
      // Include the standard oid system
      system = systemOid;
    } else {
      // Replace oid system with the url system, if one exists
      if (systemUri !== null) {
        system = systemUri.uri;
      } else {
        system = systemOid;
      }
    }

    codeList.push({ code, system, version });
  }

  // Format according to the current valueset db JSON.
  vsDB[vsOID] = {};
  let myCodes = codeList.map(elem => new Code(elem.code, elem.system, elem.version));
  vsDB[vsOID][vsVersion] = new ValueSet(vsOID, vsVersion, myCodes);
}

module.exports = { name: 'SVS', downloadValueSet };
