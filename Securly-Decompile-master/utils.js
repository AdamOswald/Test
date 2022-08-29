function setupOrReload() {
	if (window.userFound == window.userStatus.FOUND &&
		window.clusterFound == window.clusterStatus.FOUND) {

		// reload all tabs with http:// or https:// if cluster is FOUND and from init load or AVOID_OS
		// the users cannot stay in bad sites after the crextn starts
		if (window.needToReloadTabs == 1) {
			checkAllLoadedTabs();
		}

		// if it is FOUND, check it back after 30 min, in case of policy changed
		setTimeout(function() {fetchClusterUrl();}, 1800000);

		// clear session storage to get the updated policy
		sessionStorage.clear();

	} else if (window.clusterFound == window.clusterStatus.AVOID_OS) {

		// if it is AVOID_OS, check it back after 30 min, in case of policy changed
		window.needToReloadTabs = 1;
		setTimeout(function() {fetchClusterUrl();}, 1800000);

		// clear session storage to get the updated policy
		sessionStorage.clear();

	} else {
		// After (re)loading the extension, we waited few seconds for login, then found it is neither registered nor avoid-os
		console.log("http://www.securly.com/crextn/blocked?useremail=" +
			window.userEmail + "&reason=notregistered" + "&cu=" +
			window.clusterUrl + "&uf=" + window.userFound + "&cf=" +
			window.clusterFound + "&ver=" + window.version + "&url=");

		// UNKNOWN_SCHOOL (notregistered), notloggedin etc all checked every N minutes
		// assuming GAfE policy will push it back in
		// setTimeout(function(){ alert("Reloading"); chrome.runtime.reload(); }, 30000);
		setTimeout(function() {fetchClusterUrl();}, 1800000);
	}
}

// Check if the school has enabled Geolocation, if so get location every 1 minute. We can do this without any delay in Crextn and in the background.
function getGeolocationStatus() {
	if (window.clusterUrl != 'unknown') {
		var sessionUrl = window.clusterUrl +  '/getGeoStatus?userEmail=' + window.userEmail;
		var request = createBlockingRequest('get', sessionUrl);
		request.onload = function() {
			window.geolocation = parseInt(request.responseText.trim());
			if (window.geolocation) {
				getGeolocation();
				if (window.geoIntervalId != null) {
					clearInterval(window.geoIntervalId);
				}
				window.geoIntervalId = setInterval(function(){
					getGeolocation();
				}, 60000);
			}
		};
		try {
			request.send();
		}
		catch(err)
		{
			console.log('Geolocation request error.');
		}
	}
}

function getGeolocation() {
	var geoOptions = {
	   timeout: 30 * 1000,
	   maximumAge: 300000 // 5 minutes
	}

	var geoSuccess = function(position) {
	  window.geoLat = position.coords.latitude;
	  window.geoLng = position.coords.longitude;
	};
	var geoError = function(error) {
	  console.log('Geolocation error occurred. Error code: ' + error.code);
	};
  
	navigator.geolocation.getCurrentPosition(geoSuccess, geoError, geoOptions);
}

// Check if user has changed networks or IPs, and if so get their new geolocation.
function getRemoteIPGeo() {
	if (window.clusterUrl != 'unknown') {
		var sessionUrl = window.clusterUrl +  '/getGeoStatus?ip=1';
		var request = createBlockingRequest('get', sessionUrl);
		request.onload = function() {
			if (request.responseText.trim() != window.geoLastIP) {
				getGeolocation();
				window.geoLastIP = request.responseText.trim();
			}
		};
		try {
			request.send();
		}
		catch(err)
		{
			console.log('Geolocation remote IP request error.');
		}
	}
}

function getVersion(callback)
{
	var xmlhttp = createBlockingRequest('GET', 'manifest.json');
	xmlhttp.onload = function (e) {
		var manifest = JSON.parse(xmlhttp.responseText);
		window.version = manifest.version;
	};
	try
	{
		xmlhttp.send();
	}
	catch (err)
	{
		console.log("Send error u2");
	}
}

function getQueryVariable(url, variable)
{
	var a = document.createElement('a');
	a.href = url;
	var s = a.search.replace(/\?/, '');

	var vars = s.split('&');
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		if (decodeURIComponent(pair[0]) == variable) {
			return decodeURIComponent(pair[1]);
		}
	}

	return "";
}

function normalizeHostname(lHostNameOrig)
{
	var lHostName = lHostNameOrig;

	if ( lHostNameOrig.indexOf('www.') == 0 )
	{
		lHostName=lHostNameOrig.substr(4);
	}
	else
	{
		if ( lHostNameOrig.indexOf('m.') == 0 )
		{
			lHostName=lHostNameOrig.substr(2);
		}
	}
	return lHostName;
}


function extractTranslateHostname(info_url)
{
	var lHostName="translate.google.com";
	var u = getQueryVariable(info_url, "u");

	if( u != "")
	{
		u = decodeURIComponent(u);
		u = u.toLowerCase();
		u = u.replace("http://", "");
		u = u.replace("https://", "");
		var slash_idx = u.indexOf("/");
		if ( slash_idx != -1 )
		{
			// / found in url
			lHostName = u.substr(0, slash_idx);
		}
		else // no / found in url
		{
			lHostName = u;
		}
	}

	return lHostName;
}

function sendDebugInfo(debugInfo)
{
	var toSendUrl = window.clusterUrl + "/debug";
	var xhr = new XMLHttpRequest();
	xhr.open('POST', toSendUrl);
	xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

	try
	{
		xhr.send(JSON.stringify(debugInfo));
	}
	catch (err)
	{
		console.log("Send error u3");
	}
}

function checkAllLoadedTabs() {
	window.needToReloadTabs = 0;
	chrome.tabs.query({}, function(tabs) {
		for (var i = 0; i < tabs.length; i++) {
			// reload all complete tabs with url starts with http or https
			if (tabs[i].url.indexOf("http://") != -1 || tabs[i].url.indexOf("https://") != -1){
				chrome.tabs.reload(tabs[i].id);
			}
		}
	});
}

// every time get a DENY result from broker.php, clear web cache in the last 5 min
// so the user cannot load bad site page from local cache
function clearWebCache(b64Url) {
	var startTime = (new Date()).getTime() - 1000 * 60 * 5;
	// try to catch the chrome runtime error and not show it in console log
	function callback() {
		if (chrome.runtime.lastError) {}
	}
	chrome.browsingData.removeCache({"since": startTime}, callback);
	try {
	var infoUrl = window.atob(b64Url);
	var hostInfo = new URL(infoUrl);
	var siteName = hostInfo.hostname.replace("www.","");
	chrome.browsingData.remove({
		"origins": [
			"https://"+siteName, 
			"https://www."+siteName
			]
	  }, {
		"cacheStorage": true,
		"fileSystems": true,
		"indexedDB": true,
		"localStorage": true,
		"pluginData": true,
		"serviceWorkers": true,
		"webSQL": true
	  }, function() {
		
	  });
	} catch(error) {
		//Avoiding Javascript to break becasue of unknwon reasons.
		console.log("Clearing web cache failed. b64Url" + b64Url);
	}
}

// get debug info from the browser
// it has clusterUrl, userEmail, session info, broker response for some sites
function getDebugInfo() {
	var debugInfo = {
		'clusterUrl': window.clusterUrl,
		'userEmail': window.userEmail
	};

	// get the session result, it is in securly.com/app/session
	var sessionUrl = window.clusterUrl.replace('crextn', 'app/session');
	var request = createBlockingRequest('get', sessionUrl);
	request.onerror = function() {
		debugInfo['sessionInfo'] = 'Network Error';
		console.log(debugInfo);
	};
	request.onload = function() {
		debugInfo['sessionInfo'] = request.responseText;
	};
	request.send();

	var filteringSites = [
		'http://www.maxim.com',
		'http://www.amazon.com',
		'http://www.google.com',
		'http://www.bing.com',
		'http://search.yahoo.com',
		'http://www.youtube.com',
		'http://mail.google.com',
		'http://plus.google.com',
		'http://www.facebook.com',
		'http://docs.google.com',
		'http://drive.google.com',
		'http://sites.google.com'
	];
	for (var i = 0; i < filteringSites.length; i++) {
		var siteUrl = filteringSites[i];
		debugInfo = getFilteringInfo(siteUrl, debugInfo);
	}
	return debugInfo;
}

// get the broker response for input site and update the debug info object
function getFilteringInfo(siteUrl, debugInfo) {
	var toSendUrl = siteUrlToBrokerUrl(siteUrl);
	var request = createBlockingRequest('get', toSendUrl);
	request.onerror = function() {
		debugInfo[siteUrl] = 'Network Error';
	};
	request.onload = function() {
		debugInfo[siteUrl] = request.responseText.trim();
	};
	request.send();
	return debugInfo;
}

// create the broker query for input site
function siteUrlToBrokerUrl(siteUrl) {
	var parser = document.createElement("a");
	parser.href = siteUrl;
	var lHostName = parser.hostname.toLowerCase();
	var b64Url = window.btoa(siteUrl);
	if (window.geolocation) {
		return window.clusterUrl + "/broker?useremail=" + window.userEmail + "&reason=crextn" + "&host=" + lHostName +
		"&url=" + b64Url + "&msg=" + "&ver=" + window.version + "&cu=" + window.clusterUrl + "&uf=" + window.userFound +
		"&cf=" + window.clusterFound + '&lat=' + window.geoLat + '&lng=' + window.geoLng;
	} else {
		return window.clusterUrl + "/broker?useremail=" + window.userEmail + "&reason=crextn" + "&host=" + lHostName +
		"&url=" + b64Url + "&msg=" + "&ver=" + window.version + "&cu=" + window.clusterUrl + "&uf=" + window.userFound +
		"&cf=" + window.clusterFound;
	}
}

// if clusterUrl is unknown or error, send a request to cluster.php first
// in that case, don't need to reload the tab because it will make the ALLOW tab to empty tab
function selfClusterCheckBeforeBroker() {
	if (window.clusterUrl === 'unknown' ||
		(window.clusterFound !== window.clusterStatus.FOUND &&
		window.clusterFound !== window.clusterStatus.AVOID_OS)) {

		window.needToReloadTabs = 0;
		fetchClusterUrl();
	}
}

// if there is no local cache of IWF list, download it in the next a few hours
function downloadIWFList() {
	localStorage.clear();
	// the iwf file hosted on aws cloud front cdn
	var iwfURL = "http://cdn1.securly.com/iwf-encode.txt";
	var request = createNonBlockingRequest('get', iwfURL);

	request.onreadystatechange = function() {
		if (request.readyState == 4) {
			if (request.status == 200) {
				// remove "/r" to avoid txt file encoding format issue
				String.prototype.replaceAll = function (search, replacement) {
					var target = this;
					return target.split(search).join(replacement);
				};
				var iwfList = request.responseText.replaceAll("\r", "").trim().split("\n");
				for (var i = 0; i < iwfList.length; i++) {
					localStorage.setItem(iwfList[i], '1');
				}
				var currTime = new Date();
				localStorage.setItem('currIWFTime', currTime);
			} else {
				// if something error
				console.log('iwf error', request.status);
			}
		}
	};
	request.send();
}

// check if current IWF list is 24 hrs ago, if so, update the IWF list
// if there is no IWF time item in local storage and no special debug IWF set, download the IWF list
function setupIWF() {
	var currTime = new Date().getTime();
	var iwfTime = Date.parse(localStorage.getItem("currIWFTime"));
	if (!isNaN(iwfTime)) {
		if ((currTime - iwfTime) >= window.IWFTimeout) {
			downloadIWFList();
		}
	} else if (isNaN(iwfTime) && window.debugIWF === 0){
		downloadIWFList();
	}
}

// encode the request url to do a match with encoded IWF list
function myB64Encode(str, step) {
	var res = window.btoa(str).split('');
	for (var i = 0; i < res.length; i++) {
		res[i] = myB64EncodeHelper(res[i], step);
	}
	return res.join('');
}

function myB64EncodeHelper(c, step) {
	var asciiPos = c.charCodeAt(0);
	if ('0' <= c && c <= '9') {
		step %= 10;
		asciiPos += step;
		if (asciiPos > '9'.charCodeAt(0)) {
			asciiPos -= 10;
		}
	}
	else if ('A' <= c && c <= 'Z') {
		step %= 26;
		asciiPos += step;
		if (asciiPos > 'Z'.charCodeAt(0)) {
			asciiPos -= 26;
		}
	}
	else if ('a' <= c && c <= 'z') {
		step %= 26;
		asciiPos += step;
		if (asciiPos > 'z'.charCodeAt(0)) {
			asciiPos -= 26;
		}
	}
	return String.fromCharCode(asciiPos);
}

function getCookies(){
  var pairs = document.cookie.split(";");
  var cookies = {};
  for (var i=0; i<pairs.length; i++){
    var pair = pairs[i].split("=");
    cookies[(pair[0]+'').trim()] = unescape(pair[1]);
  }
  return cookies;
}

function setCookie(cname, cvalue, exmins) {
    var d = new Date();
    d.setTime(d.getTime() + (exmins * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function setClassroomCookies() {
	
	chrome.cookies.getAll({domain: "securly.com",name:"live_session"},function(curCookie){
		if(curCookie && curCookie.length > 0) {
			setCookie('live_session',curCookie[0].value,5);	
		} else {
			setCookie('live_session',"0",5);	
		}
	});

	chrome.cookies.getAll({domain: "securly.com",name:"classroom_enabled"},function(curCookie){
		if(curCookie && curCookie.length > 0) {
			setCookie('classroom_enabled',curCookie[0].value,1440);	
		} else {
			setCookie('classroom_enabled',"0",1440);	
		}
	});
}

function doBrokerForClassroom(){
	var cookiesData = getCookies();
	if(cookiesData.classroom_enabled == 1 && (typeof cookiesData.classroom_enabled != "undefined")){
		if(cookiesData.live_session == 1 && (typeof cookiesData.live_session != "undefined")){
			return true;
		} else {
			var timeStamp = Math.floor(Date.now() / 1000);
			if(typeof cookiesData.last_broker_call != "undefined" ){
				if((timeStamp-cookiesData.last_broker_call) > (5*60)){
					return true; 
				} else {
					return false;
				}
			} else {
				setCookie('last_broker_call',timeStamp,5);
				return true; 
			}
		}		
	} else {
		return false;
	}
}