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
        this.z=(z!==undefined)?z:0.0;
    }
}

/// p = plus, adds vectors
vec3.prototype.p = function(b) {
    return new vec3(this.x+b.x, this.y+b.y, this.z+b.z);
}
vec3.prototype.pe = function(b) {
    this.x+=b.x; this.y+=b.y; this.z+=b.z;
    return this;
}

/// m = minus, subtracts vectors
vec3.prototype.m = function(b) {
    return new vec3(this.x-b.x, this.y-b.y, this.z-b.z);
}
vec3.prototype.me = function(b) {
    this.x-=b.x; this.y-=b.y; this.z-=b.z;
    return this;
}

/// t = times, multiplies a vector by a scalar
vec3.prototype.t = function(b) {
    return new vec3(this.x*b, this.y*b, this.z*b);
}
vec3.prototype.te = function(b) {
    this.x*=b; this.y*=b; this.z*=b;
    return this;
}

/// Return the euclidean length of vector
vec3.prototype.length = function() { 
    return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);
}

/// Make this vector have length 1 (normalize the length)
vec3.prototype.normalize = function() {
    var len=this.length();
    if (len) return this.te(1.0/length);
    else return this; // zero vector
}

/// Compute the dot product of these two vectors
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
CIM.Read_Entity_Async=function(entityName,callback) {
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
            data:null, // <- will contain parsed JSON
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
                cacheline.data=CIM.invalid; //<- server gave us a definitive answer
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
                
                // Data arrived: fire all waiting callbacks
                //   (if 404 or bad JSON, fires with CIM.invalid)
                cacheline.waitlist.forEach(w => w(cacheline.data));
                cacheline.waitlist=[];
            }
        };
        req.send(null); 
    }
}


/** Add up these two "Resources" objects into the target.
    Works like   target += source; 
    
    @param[inout] target  Resource object getting added to.
    @param[in] source  Read-only resource object getting read from.
*/
CIM.Add_Resources = function (target,source) 
{
    for (resource in source) 
    {
        if (target[resource]) 
        { // target already exists, need to merge
            var t=target[resource];
            var s=source[resource];
            if (t.Value !== undefined && s.Value!== undefined)
            { // need to combine Values
                if (t.Unit == s.Unit) { // same units (common case)
                    t.Value += s.Value;
                } 
                else if (t.Unit == "tonne" && s.Unit == "kg") {
                    t.Value += 1.0e-3 * s.Value;
                } 
                else if (t.Unit == "kg" && s.Unit == "g") {
                    t.Value += 1.0e-3 * s.Value;
                } 
                else if (t.Unit == "tonne" && s.Unit == "g") {
                    t.Value += 1.0e-6 * s.Value;
                } 
                else 
                { // Be conservative: don't silently combine different units just because they have the same name
                    if (!t.IncompatibleUnits)
                        t.IncompatibleUnits=[];
                    t.IncompatibleUnits.push(s);
                }
            }
        }
        else 
        { // New resource, just (deep) copy
            target[resource]=JSON.parse(JSON.stringify(source[resource]));
        }
    }
}

/** Loop over each of the local components of this entity object,
   and call the callback for each component. 
   
   @param[in] entity  Parsed Entity object.
   @param[callbac] callback  Function taking the component object, and optional component string name.
*/
CIM.Component_Loop = function(entity,callback) {
    for (componentName in entity.Components) 
    {
        var comp=entity.Components[componentName];
        callback(comp,componentName);
    }
}

/** Roll up all cumulative Resources used by this Entity
and all its components (and all their components, and so on).
Eventually calls callback(resources).
*/
CIM.Component_Resources_Async = function(entityName,callback) {
    CIM.Read_Entity_Async(entityName,
        function(entity) 
        {
            var waiting=0; //<- resource requests still outstanding
            var resources=entity.Resources; //<- will accumulate our resources
            
            function check_done() {
                if (waiting==0) { 
            console.log("Calling resources callback for "+entityName);
                    callback(resources); 
                    waiting=-999; 
                }
            }
            
            if (entity.Components) 
            {
                CIM.Component_Loop(entity, component => waiting++);
                if (waiting>0) // Copy, to not trash original during total-up
                    resources=JSON.parse(JSON.stringify(resources)); 
                CIM.Component_Loop(entity, 
                    function (component,componentName) 
                    { // Total up this subcomponent's resources.
                        CIM.Component_Resources_Async(
                            component.Entity,
                            function(compRes) {
                                CIM.Add_Resources(resources,compRes);
                                waiting--;
                        console.log("From "+entityName+" wait "+waiting+" JSON target "+JSON.stringify(resources)+"   JSON compRes "+JSON.stringify(compRes));
                                check_done();
                            }
                        );
                    }
                );
            }
            
            check_done();
        }
    );
}





