This is a VERY EARLY web-based interface for interacting with 
the "City Information Model (CIM)", pronounced "sim" because it's
designed to grow to a full simulation of a real city on Mars.

Type "make server" to fire off a chrome tab watching these files,
served from python3.

The design document is:
   https://docs.google.com/document/d/1Mcw3A4k_dxy3gZI7BGNNyW5CkX5DZyrOFMMbCEWqCCY/edit#

Currently, there is no GUI and only the haziest stubs for position handling.
But the JSON species files exist, and there's a text HTML page that pulls
them from a server (any static file server works currently, but we will eventually 
move most of the geographic processing on server side).

Near-term plans:
* Add coordinate handling to make at least a crude lat/lon 2D graphical interface.
* Integrate real terrain info to get heights correct.
* Integrate hyperlinks to real models to enable 3D rendering in Unity.
* Start building out habitat JSON files.

Long-term plans:
* Switch from static JSON files to dynamic server objects.
* Graphical 2D / 3D editor for building and vehicle designs
* Design comet-style batched server comms, to support multiplayer.
* Support "Hazard" scenarios like industrial accident, power failure, micrometeorite impact.

CIM was designed to support the Nexus Aurora project, which seeks to design a
sustainable million-person city on Mars using open source.
	https://reddit.com/r/NexusAurora/

