# Browserfy-cql-exec-vsac
This project is forked from the original [cql-exec-vsac](https://github.com/cqframework/cql-exec-vsac) with the aim of enabling the code service to function entirely on the clientside.
Two features changes allow for this clientside functionality:
1. Removed caching feature
2. Create parameters for custom server url request (to workaround CORS) 


### Examples

Using the default NIH server url. 
```javascript
import vsac from 'browserfy-cql-exec-vsac';

let codeService = new vsac.CodeService(true, // Use defualt NIH Server
                                      true); // Use FHIR instead of SVS

codeService.ensureValueSetsInLibraryWithAPIKey(library, true, API_KEY); // Check library valueset with API KEY
```

Perhaps you are unable to make calls to a separate API from browser due to CORS protections. You could use a different custom url to route your api calls to a different server that acts exactly as the NIH server.
```javascript
import vsac from 'browserfy-cql-exec-vsac';

let codeService = new vsac.CodeService(false, // Use defualt NIH Server
                                      true, // Use FHIR instead of SVS
                                      'https://localhost/RetrieveSvsValueSet', // Custom url for SVS api. 
                                      'https://localhost/RetrieveFhirValueSet/{{oid}}' // Custom url for Fhir api. {{oid}} is a template variable that will be replace by the proper oid before the call. 
);

codeService.ensureValueSetsInLibraryWithAPIKey(library, true, API_KEY); // Check library valueset with API KEY
```

### Further information
For further information regarding cql-exec-vsac, see the original repository [https://github.com/cqframework/cql-exec-vsac](https://github.com/cqframework/cql-exec-vsac)
