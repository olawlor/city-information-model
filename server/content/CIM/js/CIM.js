/**
JavaScript implementation of City Information Model (CIM) for Nexus Aurora.

Originally written by Dr. Orion Lawlor <lawlor@alaska.edu>, 2020-07 (Public Domain)

*/

/** This is the singleton that represents your connection to the CIM server. 
*/
CIM={
    // This object is returned when the HTTP or JSON parse fails.
    invalid:{"Invalid":"True","Metadata":{"Entity":"Invalid"}},
    
    // This cache is used to avoid repeated network access for the same entity
    cache:{
        entity:{} ///<- cache for Entity data loaded from the server
    },
    
    /** A CIM Entity object may have the following fields at runtime.  All fields are optional.

        Metadata: Entity name, Author, Version, Purpose, etc.  Mostly human readable.
        
        Resources: fields that propagate up from components to containers.
            Example: Mass
        
        Traits: fields that propagate down from containers to components.
            Example: Geographic, defines lat/lon grid
        
      There are no class methods for a CIM Entity, hence these fields appear only at runtime
      after loading the Entity data in JSON from the server.
    */
    Entity:{},
    
    /** Contains utility functions for handling Entity Resources. */
    Resources:{},
    
    /** Contains utility functions for handling Component and Container relationships. */
    Component:{},
    Container:{}

};


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
    if (y !== undefined) 
    { // we got 2 or 3 arguments (common case)
        this.x=arg;
        this.y=y;
        this.z=(z!==undefined)?z:0.0;
    }
    else 
    { // (y===undefined), we only have a the first argument
        if (typeof(arg)=== "number") 
        { // Initialize everything to a scalar, like 0 or 3
            this.x=this.y=this.z=arg;
        }
        else if (typeof(arg)=== "object" && arg.z!== undefined)
        { // (Deep) copying from another vector-like object.
            this.x=arg.x;
            this.y=arg.y;
            this.z=arg.z;
        }
        else if (typeof(arg)=== "object" && arg.length && arg.length>=2 && arg.length<=3) 
        { // Initialize from an array, like [3,4] or [6,7,8]
            this.x=arg[0];
            this.y=arg[1];
            this.z=(arg.length>=2)?arg[2]:0.0; 
        }
        else throw "Parameter to vec3 constructor is not recognized: "+arg;
    }
}

/// Make a new deep copy of this vector
vec3.prototype.clone=function() {
    return new vec3(this.x,this.y,this.z);
}

/// Set the x,y,z values of this vector to this value.
vec3.prototype.set=function(x,y,z) {
	this.x=x;
	this.y=y;
	this.z=z;
	return this;
}

/// p = plus, adds vectors tip to tail, and returns the sum as a new vector.
vec3.prototype.p = function(b) {
    return new vec3(this.x+b.x, this.y+b.y, this.z+b.z);
}
/// pe = plus-equals, adds another vector to this one.  Return this modified vector.
vec3.prototype.pe = function(b) {
    this.x+=b.x; this.y+=b.y; this.z+=b.z;
    return this;
}

/// m = minus, returns the difference of this and another vector as a new vector.
vec3.prototype.m = function(b) {
    return new vec3(this.x-b.x, this.y-b.y, this.z-b.z);
}
/// me = minus-equals, subtracts another vector from this one.  Return this modified vector.
vec3.prototype.me = function(b) {
    this.x-=b.x; this.y-=b.y; this.z-=b.z;
    return this;
}

/// t = times, multiplies a vector by a scalar, making a new vector.
vec3.prototype.t = function(b) {
    return new vec3(this.x*b, this.y*b, this.z*b);
}

/// te = times-equals, multiply this vector by a scalar.  Return this modified vector.
vec3.prototype.te = function(b) {
    this.x*=b; this.y*=b; this.z*=b;
    return this;
}

/// max_e = maximum-equals, modify this vector to be the larger of current and this one.
///  This is useful for bounding box maintenance.
vec3.prototype.max_e = function(b) {
    if (b.x>this.x) this.x=b.x;
    if (b.y>this.y) this.y=b.y;
    if (b.z>this.z) this.z=b.z;
    return this;
}

/// min_e = minimum-equals, modify this vector to be the smaller of current and this one.
///  This is useful for bounding box maintenance.
vec3.prototype.min_e = function(b) {
    if (b.x<this.x) this.x=b.x;
    if (b.y<this.y) this.y=b.y;
    if (b.z<this.z) this.z=b.z;
    return this;
}

/// max = vector maximum.  Return a new vector with each component the larger of these two.
vec3.prototype.max = function(b) {
    return new vec3(this).max_e(b);
}
/// min = vector minimum.  Return a new vector with each component the smaller of these two.
vec3.prototype.min = function(b) {
    return new vec3(this).min_e(b);
}

/// Return the euclidean distance between these vectors, as a number
vec3.prototype.distance = function(b) { 
    var dx=this.x-b.x;
    var dy=this.y-b.y;
    var dz=this.z-b.z;
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
}

/// Return the euclidean length of this vector, as a number
vec3.prototype.length = function() { 
    return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);
}

/// Make this vector have length 1 (normalize the length)
vec3.prototype.normalize = function() {
    var len=this.length();
    if (len) return this.te(1.0/length);
    else return this; // zero vector
}

/// Compute the dot product of these two vectors and return the scalar
vec3.prototype.dot = function(b) {
    return this.x*b.x+this.y*b.y+this.z*b.z;
}

/// Compute the right-handed cross product of these two vectors as a new vector
vec3.prototype.cross = function(b) {
    return new vec3(
        this.y*b.z-this.z*b.y,
        this.z*b.x-this.x*b.z,
        this.x*b.y-this.y*b.x
    );
}


/// Allow vec3 to be output like a string (e.g., to the console)
vec3.prototype.toString=function() {
	return " ["+
		this.x.toFixed(3)+", "+
		this.y.toFixed(3)+", "+
		this.z.toFixed(3)+"] "
	;
}

/// Compute a random 3D position between -scale and +scale on each axis.
///   This is useful for creating randomized vectors for testing.
vec3.prototype.random=function(scale) {
	this.x=scale*2*(Math.random()-0.5);
	this.y=scale*2*(Math.random()-0.5);
	this.z=scale*2*(Math.random()-0.5);
	return this;
}

/// Compute a random point inside the volume of a sphere, with this radius
vec3.prototype.random_sphere=function(radius) {
	do {
		this.rand(radius);
	} while (this.length()>radius);
	return this;
}


/******************* CIM Bounding box *************************/
/** 
 A CIM.BBox is a 3D axis-aligned bounding box, defined by a "min" and "max" point.
*/
CIM.BBox=function() {
    this.min=new vec3(1.0e30);
    this.max=new vec3(-1.0e30);
}

/// Return true if this bounding box is empty, containing no volume.
CIM.BBox.prototype.Is_Empty=function() {
    return this.min.x>this.max.x;
}

/// Return the center point of this bounding box (= (min + max)/2)
CIM.BBox.prototype.Get_Center=function() {
    return this.min.p(this.max).te(0.5);
}

/// Return the size of this bounding box (= max minus min)
CIM.BBox.prototype.Get_Size=function() {
    return this.max.m(this.min);
}

/// Modify this box to include this new vec3 point
CIM.BBox.prototype.Encapsulate=function(p) {
    this.min.min_e(p);
    this.max.max_e(p);
}

/// Return true if this box includes this vec3 point
CIM.BBox.prototype.Contains=function(p) {
    return 
        (this.min.x<=p.x) && (p.x<this.max.x)
     && (this.min.y<=p.y) && (p.y<this.max.y)
     && (this.min.z<=p.z) && (p.z<this.max.z);
}

/// Return a nicely formatted version of this bounding box
CIM.BBox.prototype.toString=function() {
    return " ["+
		this.min.x.toFixed(3)+","+
		this.max.x.toFixed(3)+", "+
		
		this.min.y.toFixed(3)+","+
		this.max.y.toFixed(3)+", "+
		
		this.min.z.toFixed(3)+","+
		this.max.z.toFixed(3)+""+
		"] "
	;
}





/******************* CIM Cartesian coordinate system **********************/
/**
 A CIM.Cartesian is a 3D cartesian coordinate system,
 defined relative to some "parent" container's coordinate system.
   
    X: the X axis of the coordinate system, in the parent coordinate system
    Y: the Y axis of the coordinate system, in the parent coordinate system
    Z: the Z axis of the coordinate system, in the parent coordinate system
    O: the origin of the coordinate system, in the parent coordinate system

 Coordinate systems are composed, translated, and rotated using these 4 vectors.
 
 A location "m" in my local coordinate system corresponds to the 
 location "p" in the parent container's coordinate system via:
    vec3 p = O + X*m.x + Y*m.y + Z*m.z;
 
 Viewed as column vectors, these correspond to this 4x4 matrix:
  [p] = [ X Y Z O ] [ m ]
  [1]   [ 0 0 0 1 ] [ 1 ]
 
 For a rotation transformation, the XYZ vectors will be orthogonal and have length 1.
 This is the standard transformation for CIM.Cartesian: because we remain in meters
 for all coordinates, the scale factor is always 1.  For coordinate systems of this type,
 we can use dot products to convert back from parent coordinates to local coordinates:
    vec3 local = vec3( (p-O).dot(X), (p-O).dot(Y), (p-O).dot(Z));
 
 
 The default constructor makes this coordinate transform be the identity:
 parent and local coordinates are equal.
*/
CIM.Cartesian=function() {
    this.X = new vec3(1,0,0);
    this.Y = new vec3(0,1,0);
    this.Z = new vec3(0,0,1);
    this.O = new vec3(0);
}

/// Make a new deep copy of this coordinate system
CIM.Cartesian.prototype.clone=function() {
    return new vec3(this.x,this.y,this.z);
}

/// Allow a CIM.Cartesian to be output like a string (e.g., to the console)
CIM.Cartesian.prototype.toString=function() {
	return 
	    "Cartesian{ \n"+
	    "  X:"+this.X+"\n"+
	    "  Y:"+this.Y+"\n"+
	    "  Z:"+this.Z+"\n"+
	    "  O:"+this.O+"\n"
	    "}\n"
	;
}

/// Given a location in local coordinates, return the location in parent coordinates.
CIM.Cartesian.prototype.Parent_From_Local = function(local) {
    var parent=this.O.p(this.X.t(local.x)).pe(this.Y.t(local.y)).pe(this.Z.t(local.z));
    return parent;
}
/// Given a direction in local coordinates, return the direction in parent coordinates.
CIM.Cartesian.prototype.Parent_From_Local_Direction = function(local) {
    var parent=this.X.t(local.x).p(this.Y.t(local.y)).pe(this.Z.t(local.z));
    return parent;
}

/// Given a location in parent coordinates, return the location in local coordinates.
///   ASSUMES XYZ axes are orthogonal and have unit length
CIM.Cartesian.prototype.Local_From_Parent = function(parent) {
    var offset=parent.m(this.O);
    var local=new vec3(offset.dot(this.X),offset.dot(this.Y),offset.dot(this.Z));
    return local;
}

/// Translate this coordinate system in local coordinates.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Translate_Local = function(local_offset) {
    this.O.pe(this.Parent_From_Local_Direction(local_offset));
    return this;
}

/// Translate this coordinate system in parent coordinates.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Translate_Parent = function(parent_offset) {
    this.O.pe(parent_offset);
    return this;
}

/// Rotate this coordinate system about the parent's X axis this many degrees right-handed.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Rotate_ParentX = function(degrees) {
    var rads=degrees*(Math.PI/180.0);
    var c=Math.cos(rads),s=Math.sin(rads);
    
    var new_Y=this.Y.t( c).pe(this.Z.t(s));
    var new_Z=this.Y.t(-s).pe(this.Z.t(c))
    this.Y=new_Y; this.Z=new_Z;
    
    return this;
}
/// Rotate this coordinate system about the parent's Y axis this many degrees right-handed.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Rotate_ParentY = function(degrees) {
    var rads=degrees*(Math.PI/180.0);
    var c=Math.cos(rads),s=Math.sin(rads);
    
    var new_X=this.X.t(c).pe(this.Z.t(-s));
    var new_Z=this.X.t(s).pe(this.Z.t( c));
    this.X=new_X; this.Z=new_Z;
    
    return this;
}
/// Rotate this coordinate system about the parent's Z axis this many degrees right-handed.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Rotate_ParentZ = function(degrees) {
    var rads=degrees*(Math.PI/180.0);
    var c=Math.cos(rads),s=Math.sin(rads);
    
    var new_X=this.X.t( c).pe(this.Y.t(s));
    var new_Y=this.X.t(-s).pe(this.Y.t(c));
    this.X=new_X; this.Y=new_Y;
    
    return this;
}




/// Compute the product of these two coordinate transforms,
///   making a new coordinate transform that goes directly from our parent to other's local.
CIM.Cartesian.prototype.Composition = function(other) {
    return this.clone().Compose_With(other);
}

/// Compute the product of this coordinate system with this other coordinate system.
///   Returns this changed coordinate system.
CIM.Cartesian.prototype.Compose_With = function(other) {
    var new_X=this.Parent_From_Local_Direction(other.X);
    var new_Y=this.Parent_From_Local_Direction(other.Y);
    var new_Z=this.Parent_From_Local_Direction(other.Z);
    
    this.Translate_Local(other.O);
    this.X=new_X;
    this.Y=new_Y;
    this.Z=new_Z;
    
    return this;
}



/**************************** CIM proper **************************/

/**
 Given a Entity name, load the Entity JSON data, potentially all the way from the server.
 Locally caches Entity objects, so subsequent calls will be fast.
 
 @param[in] entityName   UTF-8 string, a fully qualified entity name, like "Vehicle/Rocket/Starship".
 @param[in] callback      User defined function taking one argument, which is the parsed entity object returned from the server, or CIM.invalid if there was a network or JSON parse error.
 
*/
CIM.Entity.Read_Async=function(entityName,callback) {
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
CIM.Resources.Add = function (target,source) 
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
CIM.Component.Loop = function(entity,callback) {
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
CIM.Resources.Total_Async = function(entityName,callback) {
    CIM.Entity.Read_Async(entityName,
        function(entity) 
        {
            var waiting=0; //<- resource requests still outstanding
            var resources=entity.Resources; //<- will accumulate our resources
            if (!resources) resources={};
            
            function check_done() {
                if (waiting==0) { 
            //console.log("Calling resources callback for "+entityName);
                    callback(resources); 
                    waiting=-999; 
                }
            }
            
            if (entity.Components) 
            {
                CIM.Component.Loop(entity, component => waiting++);
                if (waiting>0) // Copy, to not trash original during total-up
                    resources=JSON.parse(JSON.stringify(resources)); 
                CIM.Component.Loop(entity, 
                    function (component,componentName) 
                    { // Total up this subcomponent's resources.
                        CIM.Resources.Total_Async(
                            component.Entity,
                            function(compRes) {
                                CIM.Resources.Add(resources,compRes);
                                waiting--;
                        //console.log("From "+entityName+" wait "+waiting+" JSON target "+JSON.stringify(resources)+"   JSON compRes "+JSON.stringify(compRes));
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





