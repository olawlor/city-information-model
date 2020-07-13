/**
JavaScript implementation of City Information Model (CIM) for Nexus Aurora.

Originally written by Dr. Orion Lawlor <lawlor@alaska.edu>, 2020-07 (Public Domain)

*/


/******************************* vec3 *****************************/
/** 3D XYZ vector class, named and modeled after GLSL's "vec3".
Because Javascript doesn't support operator overloading, we have short single-letter names for common operators:

Examples:
    var a=new vec3([7,5])


    p  for "plus", add vectors making a new vector, like z=a.p(b) for z=a+b;
    pe for "plus-equal", add another vector to us, so a.pe(b) is a+=b;
    t  for "times", multiply a vector by a scalar like z=v.t(2) for z=v*2;
    te for "times-equal", multiply this vector by a scalar like v.te(2) for v*=2;
It's all members, to avoid polluting the global namespace for things like "dot"
and "cross".
*/
function vec3(arg,y,z) { 
    if (y===undefined) { // only the first argument
        if (typeof(arg)=== "number") 
        { // Initialize everything to a scalar, like 0 or 3
            this.x=this.y=this.z=arg;
        }
        else if (typeof(arg)=== "object" && arg.length && arg.length>=2 && arg.length<=3) 
        { // Initialize from an array, like [3,4] or [6,7,8]
            this.x=arg[0];
            this.y=arg[1];
            this.z=(arg.length>=2)?arg[2]:0.0; 
        }
        else throw "Parameter to vec3 constructor is not recognized: "+arg;
    }
    else {  // given at least 2 arguments
        this.x=arg;
        this.y=y;
        this.z=z?z:0.0;
    }
}

/// p = plus, adds vectors
vec3.prototype.p = function(b) {
    return new vec3(this.x+b.x, this.y+b.y, this.z+b.z);
}
vec3.prototype.pe = function(b) {
    this.x+=b.x; this.y+=b.y; this.z+=b.z;
}

/// m = minus, subtracts vectors
vec3.prototype.m = function(b) {
    return new vec3(this.x-b.x, this.y-b.y, this.z-b.z);
}
vec3.prototype.me = function(b) {
    this.x-=b.x; this.y-=b.y; this.z-=b.z;
}

/// t = times, multiplies a vector by a scalar
vec3.prototype.t = function(b) {
    return new vec3(this.x*b, this.y*b, this.z*b);
}
vec3.prototype.te = function(b) {
    this.x*=b; this.y*=b; this.z*=b;
}

/// Compute euclidean length of vector
vec3.prototype.length = function() { 
    return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);
}

/// Compute dot product of these two vectors
vec3.prototype.dot = function(b) {
    return this.x*b.x+this.y*b.y+this.z*b.z;
}




/**************************** CIM proper **************************/
/** This is the singleton that represents your connection to the CIM server. 
*/
CIM={
    // This object is returned when the HTTP or JSON parse fails.
    invalid:{"Invalid":"True","Metadata":{"Entity":"Invalid"}},
    
    cache:{
        entity:{}
    }
};

/**
 Given a Entity name, load the Entity JSON data, potentially all the way from the server.
 Locally caches Entity objects, so subsequent calls will be fast.
 
 @param[in] entityName   UTF-8 string, a fully qualified entity name, like "Vehicle/Rocket/Starship".
 @param[in] callback      User defined function taking one argument, which is the parsed entity object returned from the server, or CIM.invalid if there was a network or JSON parse error.
 
*/
CIM.readEntity=function(entityName,callback) {
    // Check the cache
    var cacheline=CIM.cache.entity[entityName];
    if (cacheline) {
        // Existing cacheline
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
        CIM.cache.entity[entityName]=cacheline;
        
        // Request data from the server
        var req = new XMLHttpRequest();
        req.overrideMimeType("application/json");
        var path = "/CIM/"+encodeURI(entityName)+".json";
        req.open('GET', path, true); 
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                if (req.status == "200") {
                    try {
                        cacheline.rawData=req.responseText;
                        cacheline.data=JSON.parse(cacheline.rawData);
                        cacheline.valid=true;
                    } catch (e) {
                        console.log("Entity "+entityName+" error in JSON parse "+e);
                    }
                } else {
                    console.log("Entity "+entityName+" error HTTP "+req.status);
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

/** Given a entity name, callback(true) if the entity exists on the server,
or callback(false) if there is no such entity. */
CIM.entityValid=function(entityName,callback) {
    CIM.readEntity(entityName,function(entityObject) {
        callback(entityObject!=CIM.invalid);
    });
}



