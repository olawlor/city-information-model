/**
JavaScript implementation of City Information Model (CIM) for Nexus Aurora.

Originally written by Dr. Orion Lawlor <lawlor@alaska.edu>, 2020-07 (Public Domain)

*/

CIM={
    // This object is returned when the HTTP or JSON parse fails.
    invalid:{"Invalid":"True","Metadata":{"Species":"Invalid"}},
    
    cache:{
        species:{}
    }
};


/**
 Given a Species name, load the Species JSON data, potentially all the way from the server.
 Locally caches Species objects, so subsequent calls will be fast.
 
 @param[in] speciesName   UTF-8 string, a fully qualified species name, like "Vehicle/Rocket/Starship".
 @param[in] callback      User defined function taking one argument, which is the parsed species object returned from the server, or CIM.invalid if there was a network or JSON parse error.
 
*/
CIM.readSpecies=function(speciesName,callback) {
    // Check the cache
    var cacheline=CIM.cache.species[speciesName];
    if (cacheline) {
        // Existing cache entry
        if (cacheline.data) {
            callback(cacheline.data);
        }
        else 
        { // Data hasn't arrived yet, we need to wait for it
            cacheline.waitlist.push(callback);
        }
    }
    else 
    { // Cache miss
        // New cacheline setup
        cacheline={
            data:CIM.invalid, // parsed JSON
            waitlist:[callback], // list of callbacks waiting for data
            valid:false 
        };
        CIM.cache.species[speciesName]=cacheline;
        
        // Request data from the server
        var req = new XMLHttpRequest();
        req.overrideMimeType("application/json");
        var path = "/CIM/"+encodeURI(speciesName)+".json";
        req.open('GET', path, true); 
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                if (req.status == "200") {
                    try {
                        cacheline.rawData=req.responseText;
                        cacheline.data=JSON.parse(cacheline.rawData);
                        cacheline.valid=true;
                    } catch (e) {
                        console.log("Species "+speciesName+" error in JSON parse "+e);
                    }
                } else {
                    console.log("Species "+speciesName+" error HTTP "+req.status);
                }
                
                // Data arrived: fire all queued callbacks
                //   (if 404 or bad JSON, fires with CIM.invalid)
                cacheline.waitlist.forEach(callback => callback(cacheline.data));
                cacheline.waitlist=[];
            }
        };
        req.send(null); 
    }
}

/** Given a species name, callback(true) if the species exists on the server,
or callback(false) if there is no such species. */
CIM.speciesValid=function(speciesName,callback) {
    CIM.readSpecies(speciesName,function(speciesObject) {
        callback(speciesObject!=CIM.invalid);
    });
}

