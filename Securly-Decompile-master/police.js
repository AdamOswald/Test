/*
function found_dirty_response(info_url)
{
	if ( (info_url.indexOf('https://') === 0) && (info_url.indexOf('translate.google.c') == -1) )
	{
		return false; // weak optimization. skip https:// sites from scanning as we have had issues like bug 156 with ple.platoweb.com
	}

	var request = createBlockingRequest("get", info_url);

	try
	{
		request.send(); // TODO: Fails on 301 redirects but browser continues which is good
	}
	catch (err)
	{
		console.log("Send error p1");
	}

	var limit = 50000; // www.yahoo.com returns 12K bytes.
	var dirtyWordList = ['fuck', 'porn'];
	var index = 0;

	var searchSpace = request.responseText.substr(0,limit).toLowerCase();

	for (index = 0; index < dirtyWordList.length; ++index)
	{
		dirtyWord = dirtyWordList[index];
		if ( searchSpace.indexOf(dirtyWord) != -1 )
		{
			return window.btoa(dirtyWord); // found a dirty word
		}
	}

	return false;
}
*/

function skipCacheAndLogAlways(lHostName, info_url)
{
	if ( lHostName.indexOf('twitter.com')!=-1 )
	{
		return 1;
	}

	if ( lHostName.indexOf('facebook.com')!=-1 )
	{
		return 1;
	}

	// Glenbrook had massive latency issues in mail.google and drive.google even when GWL had it on. There are just a TON of queries to the backend for these
	if ( (lHostName.indexOf('google.co')!=-1) && (lHostName.indexOf('mail.google.co')==-1) && (lHostName.indexOf('drive.google.co')==-1) )
	{
		return 1;
	}

	if ( (lHostName.indexOf('bing.co')!=-1) )
	{
		return 1;
	}

	if ( (lHostName.indexOf('search.yahoo.co')!=-1) )
	{
		return 1;
	}

	if ( (lHostName.indexOf('wikipedia.org')!=-1) )
	{
		return 1;
	}

	if ( (lHostName.indexOf('youtube.co')!=-1) )
	{
		return 1;
	}

	return 0;
}

/**
 * This will check if URL redirect to blocked page is still in progress
 * Returns true if blocking is in progress else false
 */
function isBlockingInProgress(tabId) {
	return new Promise(function(resolve, reject) {
		chrome.tabs.get(tabId, function(tab){
			if(tab && tab.status == 'loading') {
				var URL = tab.url;
				if(typeof tab.pendingUrl != 'undefined') {
					URL = tab.pendingUrl;
				}

				var hostname = getLocation(URL).hostname;
				// check if hostname has securly.com which is for blocked page hosted on server
				// or if hostname is extension ID which is for blocked page hosted in chrome extension itself
				if(hostname.indexOf("securly.com") != -1 || hostname.indexOf("iheobagjkfklnlikgihanlhcddjoihkg") != -1) {
					resolve(true);
					return;
				}
			}

			resolve(false);
		})
	});
}

// check url hostname and pathname
function getLocation(href) {
	var location = document.createElement("a");
	location.href = href;
	return location;
};

function interceptOrNot(info) {
	var intercept = 0;
	var info_type = info.type;
	var info_url = info.url;

	var urlHost = getLocation(info_url).hostname;
	var urlPath = getLocation(info_url).pathname;

	// don't intercept any request if it is AVOID_OS
	if (window.clusterFound == window.clusterStatus.AVOID_OS) {
		intercept = 0;
		return intercept;
	}

	//we do not have ability to filtering file so don't filter
	if(info.url.indexOf("file") === 0){
        return 0;
	}

	// check local storage to see if there is any request to IWF URLs
	// if there is a match IWF request, show the global blacklist block page
	// remove the http:// or https:// or www. from the beginning, the URL may have parameters so cannot use just hostname and path
	var url = info_url.replace(/^https?\:\/\//i, "");
	url = url.replace(/^www\.\b/i, "");
	
	// CREXTN-61
	var urlLength = url.length;
	var lastChar = url.charAt(urlLength - 1);
	if (lastChar === '/') {
		url = url.slice(0, -1);
	}
	var encodedUrl = ENCRYPT(url); // CREXTN-61
	if (localStorage.getItem(encodedUrl) !== null) {
		takeDenyActionTabs("G", "BL", "", window.btoa(url), info.tabId);
		intercept = 0;
		return intercept;
	}

	// don't convert youtube.com URL since the video ID is case sensitive
	if (info_url.indexOf('youtube.com') == -1) {
		info_url = info_url.toLowerCase();
	}

	// ignore get, img, scripts and other resource requests
	if (info_type !== "main_frame" &&
		info_type !== "sub_frame" &&
		info_type !== "xmlhttprequest") {

		intercept = 0;
		return intercept;
	}

	// let securly.com request pass
	if (urlHost.indexOf("securly.com") != -1) {
		intercept = 0;

		// if visiting securly.com/crextn/debug, crextn will generate debug info and send it to debug.php
		if (urlPath.indexOf("crextn/debug") != -1 && info_type != "xmlhttprequest") {
			var debugInfo = getDebugInfo();
			debugInfo["sourceFunction"] = "interceptOrNot";
			sendDebugInfo(debugInfo);
		}
		return intercept;
	}

	// intercept posting on FB, Twitter and G+
	if (urlHost.indexOf("twitter.com") != -1 &&
		( urlPath.indexOf(window.twitterMessageURI) != -1 || 
		(info_url.indexOf(window.twitterPrefetchTimestamp) != -1) && info.tabId == -1) &&
		info_type == "xmlhttprequest") {

		intercept = 1;
		return intercept;
	}



	if (urlHost.indexOf("facebook.com") &&
		(urlPath.indexOf("updatestatus") != -1 || 
		urlPath.indexOf('webgraphql') != -1 ||
		urlPath.indexOf('api/graphql') != -1) &&
		info_type == "xmlhttprequest") {

		intercept = 1;
		return intercept;
	}

	if (urlHost.indexOf("google.co") != -1 &&
		urlPath.indexOf("/plusappui/mutate") != -1 &&
		info_type == "xmlhttprequest") {
		intercept = 1;
		return intercept;
	}

	// For google, only add safe search parameters on web search
	if (urlHost.indexOf("google.co") != -1) {
		intercept = 0;

		// ignore all non xmlhttprequest and non main_frame requests
		if (info_type != "xmlhttprequest" && info_type != "main_frame") {
			intercept = 0;
			return intercept;
		}

		// don't intercept account, docs, calender, sites, code, cloudprint, etc.
		// don't intercept chrome new tab url
		// don't intercept google search auto complete query
		// don't intercept google new tab url on chromebook, which is google.com/webhp...
		if (urlHost.indexOf("accounts.google.co") != -1 ||
			urlHost.indexOf("docs.google.co") != -1 ||
			urlPath.indexOf("/calendar/") != -1 ||
			urlHost.indexOf("code.google.co") != -1 ||
			urlPath.indexOf("/cloudprint") != -1 ||
			urlPath.indexOf("/_/chrome/newtab") != -1 ||
			urlHost.indexOf("appengine.google.com") != -1 ||
			urlPath.indexOf("/complete/search") != -1 ||
			urlPath.indexOf("/webhp") != -1) {

			intercept = 0;
			return intercept;
		}

		// intercept web search, gmail and google drive
		// schools may not allow students login to google apps with their own account
		if (urlPath.indexOf("/search") != -1 ||
			urlPath.indexOf("/#q") != -1 ||
			urlHost.indexOf("translate.google.co") != -1) {
			intercept = 1;
			return intercept;
		}

		// gmail and google drive need the google restricted domain login
		if (urlHost.indexOf("mail.google.co") != -1 && info_type == "main_frame") {
			intercept = 1;
			return intercept;
		}

		if (urlHost.indexOf("drive.google.co") != -1 && info_type == "main_frame") {
			intercept = 1;
			return intercept;
		}

		// SUPASKS-79, schools ask to block game sites hosted on sites.google.com
		if (urlHost.indexOf("sites.google.co") != -1 && info_type == "main_frame") {
			intercept = 1;
			return intercept;
		}

		// SUPASKS-56, schools ask to block google plus and hangouts
		// intercepting hangouts is a mistake, but since it is already in prod for a while, we decide not to touch it
		if (urlHost.indexOf("hangouts.google.co") != -1 && info_type == "main_frame") {
			intercept = 1;
			return intercept;
		}

		// ATTN: blocking plus.google.com will also block hangouts video call, need to let schools and supports know it
		if (urlHost.indexOf("plus.google.co") != -1 && info_type == "main_frame") {
			intercept = 1;
			return intercept;
		}

		return 0; // explicitly return 0 now that Google is done
	}

	// ignore some youtube unnecessary url to avoid duplicate query
	// TODO: need to improve in the future
	if (
		(urlHost.indexOf("youtube.com") != -1) &&
		(urlPath.indexOf("watch_fragments_ajax") != -1 ||
		 urlPath.indexOf("doubleclick/DARTIframe.html") != -1 ||
		 urlPath.indexOf("ad_data_204") != -1 ||
		 urlPath.indexOf("annotations_invideo") != -1 ||
		 urlPath.indexOf("api/stats/atr") != -1 ||
		 urlPath.indexOf("get_video_info") != -1)
	   ) {

		intercept = 0;
		return intercept;
	}

	// Handle only main-frames except /watch and /result urls of YouTube
	// TODO: why we need to intercept sub_frame and xmlhttprequest?
  if ((info_type == "main_frame" ||
    info_type == "sub_frame" ||
    info_type == "xmlhttprequest") &&
    urlHost.indexOf("youtube.com") != -1) {
		if(urlPath == "/") return 1;
    if(urlPath.indexOf("/results") == -1 && urlPath.indexOf("/watch") == -1) return 0;
    intercept = 1;
    return intercept;
  }

	// let sub_frame request to facebook pass for bing.com need it
	// we need to let bing.com not get blocked
	if (urlHost.indexOf("facebook.com") != -1 && info_type == "sub_frame") {
		intercept = 0;
		return intercept;
	}

	// ignore bing login verification and ssl connection requests
	if ((urlHost.indexOf("bing.com") != -1 && urlPath.indexOf("/fd/fb") != -1) ||
		urlHost.indexOf("ssl.bing.com") != -1 ||
		urlPath.indexOf("/passport.aspx") != -1) {

		intercept = 0;
		return intercept;
	}

	// TODO: don't know why we need this
	if (urlHost.indexOf("bing.com") != -1 && info_type === "sub_frame") {
		intercept = 1;
		return intercept;
	}

	// after all these special cases, we only care about main_frame requests
	if (info_type == "main_frame" || (info_type == "sub_frame" && window.checkiFrames == 1)) {
		intercept = 1;
		return intercept;
	}

	return intercept;
}

// TODO: seems to be dead code since we can block the actual tab that sends the web request?
// find the tab that has the curUrl, then update it with the blockUrl
/*
function blockTabByUrl(curUrl, blockUrl, tries)
{
	chrome.tabs.query
	(
		{url: curUrl},
		function tabsGetByUrlCallback(curTab)
		{
			if (curTab[0])
			{
				curTabId=curTab[0].id;

				chrome.tabs.update
				(
					curTabId, {url: blockUrl}
				);
			}
		}
	);

	tries++;
	if (tries < 10)
	{
		setTimeout(function(){ blockTabByUrl(curUrl, blockUrl, tries); }, 100);
	}
}
*/

function getBlockUrl(policyStr, categoryStr, keywordScanStr, b64Url, isSubFrame)
{
	var reason = "domainblockedforuser";
	var keyword = "";

	if (policyStr == "GL") {
		reason = "GEO";
	}

	if (keywordScanStr != "-1") {
		reason = "safesearch";
		keyword = window.btoa(keywordScanStr);
	}

	if ( categoryStr == "BL" )
	{
		if ( policyStr == "G" )
		{
			reason = "globalblacklist";
		}
		else
		{
			reason = "policyblacklist";
		}
	}
        if ( categoryStr == "WL" ) {
            reason = "whitelistonly";
        }
	if (window.clusterUrl == 'unknown')
	{
		return;
	}
	else
	{
		var curUrl = window.atob(b64Url);
		var siteCurUrl = curUrl.substr(curUrl.indexOf("://") + 3);
		b64Url = window.btoa(siteCurUrl);
		var blockHostUrl = window.clusterUrl.replace("/crextn", "");
		var userAccount = window.userEmail;
		var blockUrl = "";

		blockUrl = blockHostUrl + '/blocked?useremail=' + userAccount + "&reason=" + reason + "&categoryid=" +
					categoryStr + "&policyid=" + policyStr + "&keyword=" + keyword + "&url=" + b64Url + "&ver=" + window.version + ((isSubFrame == true) ? '&subFrame=1' : '');
	return blockUrl;
	}
}

function takeDenyActionTabs(policyStr, categoryStr, keywordScanStr, b64Url, tabId, isSubFrame = false)
{
	clearWebCache(b64Url);

	var reason = "domainblockedforuser";
	var keyword = "";

	if (policyStr == "GL") {
		reason = "GEO";
	}

	if (keywordScanStr != "-1") {
		reason = "safesearch";
		keyword = window.btoa(keywordScanStr);
	}

	if ( categoryStr == "BL" )
	{
		if ( policyStr == "G" )
		{
			reason = "globalblacklist";
		}
		else
		{
			reason = "policyblacklist";
		}
	}
	if(categoryStr == "BANNED" ){
		reason = "banned";
	}
        
        /* 
         * Author : Rahul Pande<rahul@securly.com>
         * QADUX-159 Crextn - "Allow Only Approved Content" Email alerts are not received
         */
        
        if ( categoryStr == "WL" ) {
            reason = "whitelistonly";
        }
        
	if (window.clusterUrl == 'unknown')
	{
		return; // Don't show www.securly.com blocked page as it will lead to cluster confusion
	}
	else
	{
		// remove the "http://" or "https://" part for b64url
		// but need to keep it in curUrl, otherwise it may cause some issue in update tab url
		var curUrl = window.atob(b64Url);
		var siteCurUrl = curUrl.substr(curUrl.indexOf("://") + 3);
		b64Url = window.btoa(siteCurUrl);

		// move the block page from "securly.com/crextn/blocked?..." (old url) to "securly.com/blocked?..." (new url)
		var blockHostUrl = window.clusterUrl.replace("/crextn", "");
		var userAccount = window.userEmail;
		var blockUrl = "";

		blockUrl = blockHostUrl + '/blocked?useremail=' + userAccount + "&reason=" + reason + "&categoryid=" +
					categoryStr + "&policyid=" + policyStr + "&keyword=" + keyword + "&url=" + b64Url + "&ver=" + window.version + ((isSubFrame == true) ? '&subFrame=1' : '');

		
		// check first that if we are already blocking request on same tab so that new request can be avoided
		isBlockingInProgress(tabId)
		.then(function(response){
			// don't update tab URL as blocking request is in progress
			if(response) return;

			setBlockedPage(tabId, blockUrl);
		})
		.catch(function(exception){
			console.log('exception in checking blocking progress', tabId)
			setBlockedPage(tabId, blockUrl);
		});

		return;
	}
}

/** 
 * Make several attempts to block the page with rationale provided 
 */
function setBlockedPage(tabId, blockUrl) {

	//For cached twitter.com we tabId as -1 for prefetched request 
	//which causes tabs.update api to fail.
	if(tabId == -1)
		tabId = null;

	// stop page load.. this will ensure that no redirect happens while we block page
	// ex. when bing or google redirects non safe search url to safe search url with one more GET param before showing search results
	if(tabId > 0) {
		window.tabsBeingBlocked[tabId] = blockUrl;
		chrome.tabs.executeScript(tabId, {
	        code: "window.stop();",
	        runAt: "document_start"
		}, function() {
			//console.log('window load stopped')
		});
	}
	
	// Attempt #1: Quickly serve a blocked page that is local to the extension to avoid network latency issues
	chrome.tabs.update(tabId, {url:'chrome-extension://iheobagjkfklnlikgihanlhcddjoihkg/blocked.html'}, function() {
		if (chrome.runtime.lastError) {}
	});

	// Attempt #2: Now try the Tab ID we had fetched at the time of broker lookup for response action (original tab)
	chrome.tabs.update(tabId, {url: blockUrl}, function(){
		// Attempt #3: Sometimes the above fails when tab ids change (roughly 1 in 10-20 times). Try current tab then
		if (chrome.runtime.lastError) {
			console.log('some error while redirecting to blocked page', chrome.runtime.lastError);
			setTimeout(function(){ 
				chrome.tabs.update(null, {url: blockUrl},  function() {});
			}, 500);
		}
	});

	//
	//var tries=3;
	//
	//// Attempt #4-10: Is for a race condition where user types maxim.com and immediately switches tabs. This is missed by all of the above. It is perhaps because the page rendered after the "by URL" lookup was made.
	//setTimeout(function(){ blockTabByUrl(curUrl, blockUrl, tries); }, 500);
}

// still being called in listener.js, so not remove it for now
// deny action should be handled all by takeDenyActionTabs()
function takeDenyAction(policyStr, categoryStr, b64Url)
{
	clearWebCache(b64Url);

	var reason = "domainblockedforuser";

	// if the user doesn't click "accpet" in the prompt, block every page
	// TODO: temp solution, need to use some friendly blocked page in the future
	if(policyStr == '0' && categoryStr == '-1')
	{
		return {cancel: true};
	}

	if ( categoryStr == "BL" )
	{
		if ( policyStr == "G" )
		{
			reason = "globalblacklist";
		}
		else
		{
			reason = "policyblacklist";
		}
	}

	if (window.clusterUrl == 'unknown')
	{
		return {cancel: true}; // Don't show www.securly.com blocked page as it will lead to cluster confusion
	}
	else
	{
		// remove the "http://" or "https://" part for b64url
		// but need to keep it in curUrl, otherwise it may cause some issue in update tab url
		var curUrl = window.atob(b64Url);
		var siteCurUrl = curUrl.substr(curUrl.indexOf("://") + 3);
		b64Url = window.btoa(siteCurUrl);

		// move the block page from "securly.com/crextn/blocked?..." (old url) to "securly.com/blocked?..." (new url)
		var blockHostUrl = window.clusterUrl.replace("/crextn", "");
		var userAccount = window.userEmail;

		return {redirectUrl: blockHostUrl + '/blocked?useremail=' + userAccount + "&reason=" + reason + "&categoryid=" +
				categoryStr + "&policyid=" + policyStr + "&url=" + b64Url + "&ver=" + window.version  + ((window.isSubFrame == true) ? '&subFrame=1' : '')};
	}
}

function takeSafeSearchAction(lHostName, info_url)
{
	// check if the current url is for google / yahoo / bing search
	// if there is no safe search parameter, add them
	// else there is already a safe search parameter, do nothing
	// "safe=active" for google, "adlt=strict" for bing, "vm=r" for yahoo
	if (lHostName.indexOf("google.co") != -1)
	{
		if ( (info_url.indexOf("/search?") != -1 || info_url.indexOf("/#q=") != -1) && info_url.indexOf("safe=active") == -1)
		{
			if (info_url.indexOf("?") != -1)
			{ return info_url + '&safe=active'; }
			else
			{ return info_url + '?safe=active'; }
		}
	}
	if (lHostName.indexOf("bing.com") != -1 && info_url.indexOf("adlt=strict") == -1)
	{
		if (info_url.indexOf("?") != -1)
		{ return info_url + '&adlt=strict'; }
		else
		{ return info_url + '?adlt=strict'; }
	}
	if (lHostName.indexOf("search.yahoo.com") != -1 && info_url.indexOf("vm=r") == -1)
	{
		if (info_url.indexOf("?") != -1)
		{ return info_url + '&vm=r'; }
		else
		{ return info_url + '?vm=r'; }
	}
	return info_url;
}


// Google / Bing / Yahoo creative common image search
function takeCreativeCommonImageSearchAction(info_url) {
	// 'tbm=isch' is the sign of google image search
	if (info_url.indexOf('google.co') != -1 &&
		info_url.indexOf('tbm=isch') != -1) {

		if (info_url.indexOf('&tbs=sur:fmc') == -1) {
			return info_url + '&tbs=sur:fmc';
		}
	}

	if (info_url.indexOf('bing.com/images/search') != -1) {
		var lowerInfoUrl = info_url.toLowerCase();
		if (lowerInfoUrl.indexOf('&qft=+filterui:license-l2_l3') == -1) {
			return info_url + '&qft=+filterui:license-l2_l3';
		}
	}

	if (info_url.indexOf('search.yahoo.com/search/images') != -1) {
		if (info_url.indexOf('&imgl=fmsuc') == -1) {
			return info_url + '&imgl=fmsuc';
		}
	}

	return info_url;
}

/*
function takeYTAction(ytSSStr, ytEduStr, ytEduAccStr, info_url)
{
	var curCookie="";

	if (ytSSStr == 1)
	{
		var urlContent = "http://.youtube.com/";

		chrome.cookies.get
		(
			{url: urlContent, name: 'PREF'},
			function(curCookie)
			{
				if (!isWhitespaceOrEmpty(curCookie.value))
				{
					window.ytpref="checkedandpreffound";
					window.ytprefoldvalue=curCookie.value;
					if (curCookie.value.indexOf("f2=8000000") != -1)
					{
						window.ytpref="checkedandf2found";
					}
					else
					{
						window.ytpref="checkedandf2notfound";

						//	window.ytpref="checkedandprefnotfound"
					}
				}
				else
				{
					//curCookie.value.replace(/ /g,'');
					//curCookie.value = curCookie.value + "&f2=8000000";

					window.ytpref="checkedandprefnotfound";
				}

				if ( window.ytpref == "checkedandprefnotfound" )
				{
					window.ytprefnewvalue="f2=8000000";
					//window.ytpref == "prefnotchecked"; // check again until you find a valid PREF
				}
				else
				{
					if ( window.ytpref == "checkedandf2notfound" )
					{
						window.ytprefnewvalue=window.ytprefoldvalue+"&f2=8000000";
					}
					else
					{
						window.ytprefnewvalue=window.ytprefoldvalue; // assume only Securly sets f2 and only to 8000000
					}
				}

				chrome.cookies.set
				(
					{
						url: urlContent,
						name: 'PREF',
						value: window.ytprefnewvalue
						//value: 'f2=8000000'
					},
					function(cookie)
					{
						if (cookie)
						{
							//console.log("new cookie value " +  cookie.value);
						}
						else
						{
							//console.log("COOKIE FAIL");
						}
					}
				);
			}
		);
	}
	return; // Allow first pass of YouTube if PREF was not checked
}
*/

/*
function takeKeywordScanAction(policyStr, info_url, b64Url)
{
	var b64DirtyWord = found_dirty_response(info_url);
	if ( b64DirtyWord != false )
	{
		// TODO: Category is always 8 for plugin (sexual content only)
		return {redirectUrl:window.clusterUrl+'/blocked?useremail=' + window.userEmail + "&reason=pagekeyword&categoryid=8&policyid="+policyStr+"&keyword=" + b64DirtyWord + "&url=" + b64Url + "&ver=" + window.version};
	}
}
*/

/*
function isWhitespaceOrEmpty(text) {
	return !/[^\s]/.test(text);
}
*/

function getYtSSRequestHeaders(info_url, requestHeaders)
{
	if (
	(info_url.indexOf("/results") != -1) ||
	(info_url.indexOf("/search") != -1) ||
	(info_url.indexOf("/watch") != -1)
	)
	{
		var cookieVal="";

		// Go through request headers to find Cookie: header
		for (var i = 0; i < requestHeaders.length; ++i) {
			if (requestHeaders[i].name === 'Cookie') {
				cookieVal = requestHeaders[i].value;
				requestHeaders.splice(i, 1);
				break;
			}
		}

		// If no Cookie: header found, just set PREF=f2=8000000 value
		if(cookieVal == "") {
			requestHeaders.push({name: 'Cookie', value: 'PREF=f2=8000000'});
		}
		else
		{
			var pref_flg = 0;
			var cookieVars = cookieVal.split("; ");

			// Go through all cookies in the Cookie: header and find PREF
			for(var i=0; i<cookieVars.length; ++i)
			{
				if(cookieVars[i].indexOf("PREF") != -1)
				{
					if(cookieVars[i].indexOf("f2=8000000") == -1) {

						cookieVars[i] += "&f2=8000000";

					}
					pref_flg = 1;
				}

				if(cookieVars[i].indexOf("SID=") != -1)
				{
					cookieVars[i] = "";
				}
			}

			// Cookie: header found, but no PREF flag found, then just set it as so
			if(pref_flg == 0)
			{
				cookieVars.push("PREF=f2=8000000");
			}

			var newCookie = "";
			for(var i=0; i<cookieVars.length; ++i)
			{
				newCookie += cookieVars[i];
				newCookie += "; ";
			}
			newCookie = newCookie.substring(0, newCookie.length-2);
			requestHeaders.push({name: 'Cookie', value: newCookie});
		}
	}
	return requestHeaders;
}

function getPauseAction(b64Url)
{
    clearWebCache(b64Url);

    if (window.clusterUrl == 'unknown')
    {
        return {cancel: true}; // Don't show www.securly.com blocked page as it will lead to cluster confusion
    }
    else
    {
        var pauseHostUrl = window.clusterUrl.replace("/crextn", "");
        return {redirectUrl: pauseHostUrl + '/paused'};
    }
}

function takePauseActionTabs(b64Url, tabId) {

    var action = getPauseAction(b64Url);

    if(typeof action.redirectUrl == 'undefined') {
        return;
    }

    var pauseUrl = action.redirectUrl;

    /* Below are several attempts to block the page with rationale provided */

    // try to catch some tabs not existed error, this maybe caused by Chrome instant search
    function callback() {
        if (chrome.runtime.lastError) {}
    }

    // Attempt #1: Quickly serve a paused page that is local to the extension to avoid network latency issues
    chrome.tabs.update(tabId, {url:'chrome-extension://iheobagjkfklnlikgihanlhcddjoihkg/blocked.html'}, callback);

    // Attempt #2: Now try the Tab ID we had fetched at the time of broker lookup for response action (original tab)
    chrome.tabs.update(tabId, {url: pauseUrl}, callback);

    // Attempt #3: Sometimes the above fails when tab ids change (roughly 1 in 10-20 times). Try current tab then
    setTimeout(function(){ chrome.tabs.update(null, {url: pauseUrl}, callback);}, 500);

    return;
}