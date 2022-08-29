window.userStatus = {
	NOTFOUND: -1,
	FOUND: 1
};

window.clusterStatus = {
	ERROR: -2,
	NOTFOUND: -1,
	FOUND: 1,
	AVOID_OS: 2,
	UNKNOWN_SCHOOL: 3
};

window.version = "-";
window.userFound = window.userStatus.NOTFOUND;
window.clusterFound = window.clusterStatus.NOTFOUND;
window.userEmail = "notloggedin";
window.clusterUrl = "unknown";
window.ytpref = "prefnotchecked";
window.ytprefnewvalue = "notset";

// Geolocation variables
window.geolocation = false;
window.geoLat = null;
window.geoLng = null;
window.geoIntervalId = null;

// needToReloadTabs = 1 means that next time when clusterFound is FOUND, need to reload all tabs
window.needToReloadTabs = 1;
window.isBlockedYTVideo = false;
// debugIWF = 0 is normal mode, 1 means disable IWF, 2 means force update IWF
window.debugIWF = 0;
window.IWFTimeout = 7 * 24 * 60 * 60 * 1000;

// iFrame blocking
window.isSubFrame = false;
window.checkiFrames = 0;

// Twitter message endpoint location
window.twitterMessageURI = '/statuses/update.json';

// Twitter prefetch request
window.twitterPrefetchTimestamp = 'prefetchtimestamp';

//This will store the tabid and blocked page URL while loading of page.
window.tabsBeingBlocked = {};

getVersion();

getGeolocationStatus();

// Check for any change in Geolocation policy setting every 1 hour
setInterval(function() {
	getGeolocationStatus();
}, 3600000)

// setup the web request listener before fetchUser()
// otherwise kids can have access to all sites as long as he doesn't click accept at the first time
setupListener();
fetchUserAPI();
setupIWF();
checkPnPHub();
// request after 5 min for checking ip rule in pnphub
(function loop() {
	var rand = (Math.floor(Math.random()*10)+5)*60000;
	setTimeout(function() {
			checkPnPHub();
			loop();
    }, rand);
}());
