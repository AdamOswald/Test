
function setupListener()
{
	
	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
		
		if(typeof changeInfo.status == 'undefined' || 
		   tab.url.indexOf('blocked') == -1) {
			
			/*
			 * Handle redirect blocked page request if blocked page got cancelled
			 * and active tab was still loaded with cached data of original request.
			 */
			if(typeof changeInfo.status != 'undefined' && 
			  changeInfo.status == 'complete' && 
			  typeof window.tabsBeingBlocked[tabId] != "undefined") {
				chrome.tabs.update(tabId, 
					{
						url: window.tabsBeingBlocked[tabId] 
					}, 
					function(){
					});
			}
			return;
		}
		
		if(changeInfo.status == 'complete') {
			delete window.tabsBeingBlocked[tabId];
			return;
		} 
		if(tab.url.indexOf('blocked') != -1 &&
		(tab.url.indexOf("securly.com") != -1 || 
		tab.url.indexOf("iheobagjkfklnlikgihanlhcddjoihkg") != -1)
		) {
			window.tabsBeingBlocked[tabId] = tab.url;
		}
	});

	/* Listen on canceled blocked page request
	 * If the tab is needs be blocked then, update
	 * that tab with the block page request.
	 */
	chrome.webRequest.onErrorOccurred.addListener
	(
		function(details)
		{
			if(details.error == "net::ERR_ABORTED" &&
				details.type == "main_frame" && 
				details.url.indexOf("blocked") != -1 &&
				typeof window.tabsBeingBlocked[details.tabId] != undefined) {
				chrome.tabs.update(details.tabId, 
				{
					url: window.tabsBeingBlocked[details.tabId] 
				}, 
				function(obj){
				});
			} 
		
		},
		{
			urls:
				["*://*.securly.com/*"]
		},
	); 

	chrome.webRequest.onBeforeSendHeaders.addListener
	(
		// callback
		function(info)
		{
			// Do not process prefetch requests
			var isPrefetch = false;
			info.requestHeaders.forEach(function(header){
				if(header.name == 'Purpose' && header.value == 'prefetch') {
					isPrefetch = true;
				}
			});

			if(isPrefetch) {
				return;
			}

			// manually trigger onBeforeRequestListener when suicidepreventionlifeline.org is accessed and is not prefetch
			if(info.url.indexOf('suicidepreventionlifeline.org') != -1) {
				return onBeforeRequestListener(info);
			}

			var info_url = info.url;
			var interceptUrl = interceptOrNot(info);

			if( interceptUrl == 1 )
			{
				var b64Msg = "";
				if (info_url.length > 1000) 
				{
					info_url = info_url.substring(0, 1000);
				}
				var b64Url = window.btoa(info_url);

				var parser = document.createElement("a");
				parser.href = info_url;
				var lHostName = parser.hostname.toLowerCase();

				var lHostNameOrig = lHostName;
				lHostName=normalizeHostname(lHostNameOrig);
				var mainHost = '';
				var isSubFrame = false;
				// Get host of main frame that requested sub frame
				if (info.type == 'sub_frame') {
					parser.href = info.initiator;
					mainHost = window.btoa(parser.hostname.toLowerCase());
					isSubFrame = true;
					window.isSubFrame = true;
				} else {
					window.isSubFrame = false;
					isSubFrame = false;
				}
				var respArr = getRespArr(lHostName, b64Url, b64Msg, info_url, mainHost, isSubFrame);

				var actionStr = respArr[0];
				var policyStr = respArr[1];
				var categoryStr = respArr[2];
				var keywordScanStr = respArr[3];
				var ytSSStr = respArr[4];
				var gmSmStr = respArr[4];
				var ytEduStr = respArr[5];
				var ytEduAccStr = respArr[6];

				// If this is an iFrame that is blocked CANCEL the request to
				// prevent site leaking.
				if (this.iframeResp.length > 0) {
					if (this.iframeResp[0] == "DENY") {
						this.iframeResp = "";
						return {cancel: true};
					}
				}

				if(actionStr == "GM") {
					info.requestHeaders.push({name: 'X-GoogApps-Allowed-Domains', value: gmSmStr});
					return{requestHeaders: info.requestHeaders}; // GM return
				}

				// TODO: Ignore keyword scanning for YT for now
				if(actionStr == "YT") {
					if (ytSSStr == 1) {
						info.requestHeaders.push({name: 'YouTube-Restrict', value: 'Strict'});
					}
					return {requestHeaders: info.requestHeaders}; // YT return
				}
				return {requestHeaders: info.requestHeaders}; // Default return
			}
		},
		// filters
		{
			urls:
				["*://suicidepreventionlifeline.org/*", "*://*.youtube.com/*", "*://accounts.google.com/*", "*://mail.google.com/*", "*://drive.google.com/*"]
		},
		// extraInfoSpec
		["blocking", "requestHeaders"] // make the callback blocking type so request waits until this returns
	);

	chrome.webRequest.onBeforeRequest.addListener
	(
		// callback
		function (info)
		{
			// Do not process any request for url suicidepreventionlifeline.org. 
			// Instead let onBeforeSendHeaders handle it
			if(info.url.indexOf('suicidepreventionlifeline.org') != -1) {
				return;
			}

			return onBeforeRequestListener(info);
		},
		// filters
		{
			urls:
				["<all_urls>"]
		},
		// extraInfoSpec
		["blocking", "requestBody"] // make the callback blocking type so request waits until this returns
	);

	chrome.identity.onSignInChanged.addListener
	(
		function(account, signedIn) {
			if (signedIn === true) {
				fetchUserAPI();
			}
		}
	);

	chrome.idle.onStateChanged.addListener(
		function(idleState) {
			if (lastKnownState != idleState) {
				if (idleState == "active" && lastKnownState != "idle") {
					sessionStorage.clear();
					chrome.windows.getAll({populate : true}, function (windowList) {
						for(var i=0;i<windowList.length;i++) {
							for(var j=0;j<windowList[i].tabs.length;j++) {
								if (windowList[i].tabs[j].url.substring(0,9) != "chrome://") {
									tabCheck.forEach(function (item) {
										if (windowList[i].tabs[j].url.indexOf(item) !== -1) {
											chrome.tabs.reload(windowList[i].tabs[j].id, {bypassCache: true});
										}
									  });
								}
							}
						}
					});
				}
				lastKnownState = idleState;
			}
		});

}

function onBeforeRequestListener(info) {
	var rawInfoURL = info.url;
	var info_url;
    var main_url;
    if(info.type == 'main_frame' && info.url.indexOf('securly') == -1 && typeof window.tabsBeingBlocked[info.tabId] != 'undefined') {
    	return {redirectUrl: window.tabsBeingBlocked[info.tabId]};
    }

	// don't convert youtube.com URL since the video ID is case sensitive
	/*if (rawInfoURL.indexOf('youtube.com') == -1) {
		info_url = rawInfoURL.toLowerCase();
	} else {
		info_url = rawInfoURL;
	}*/
	info_url = rawInfoURL;
	
	var interceptUrl = interceptOrNot(info);
    if(info.type == "sub_frame" && info.initiator == "file://" && info.url.indexOf("http") === 0){
        interceptUrl = 1;
	}

	if( interceptUrl == 1 )
	{
        var mainHost = '';
        var isSubFrame = false;
        // Get host of main frame that requested sub frame
        if (info.type == 'sub_frame') {
            var parser = document.createElement("a");
            parser.href = info.initiator;
            mainHost = window.btoa(parser.hostname.toLowerCase());
            isSubFrame = true;
            window.isSubFrame = true;
        }
		var b64Msg = "";
        if (info_url.length > 1000) 
        {
            info_url = info_url.substring(0, 1000);
        }
		b64Msg = getSocialPost(info, info_url);
		
		if(b64Msg === false) {
			return;
		}
		var b64Url = window.btoa(info_url);

		var lHostName;
		if(info_url.indexOf("translate.google.com") != -1)
		{
			lHostName = extractTranslateHostname(info_url);
		}
		else
		{
			var parser = document.createElement("a");
			parser.href = info_url;
			lHostName = parser.hostname.toLowerCase();
		}

		var lHostNameOrig = lHostName;
		lHostName = normalizeHostname(lHostNameOrig);

		// If geolocation is turned on, get user location if the IP has changed.
		if (window.geolocation) {
			getRemoteIPGeo();
		}

		// info.tabId is the id of tab which sends this web request, and it may be not the current tab
        var respArr = getRespArrTabs(lHostName, b64Url, b64Msg, info_url, info.tabId, mainHost, isSubFrame, this);

		/*

		Response string formats:

		value of "-1" wherever a field is irrelevant

		"ALLOW:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // allow
		"DENY:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // deny
		"SS:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // safe search for G/B/Y
		"YT:$policy_id:$genes_vector:$keyword_scanning:$yt_sm:$yt_edu:$yt_edu_string"; // safety &/or edu mode for YT
		"GM:$policy_id:$genes_vector:$keyword_scanning:$gm_sm_string:-1:-1"; // "safety mode string" for GM and Google drive

		Examples:
		"ALLOW:0:-1:-1:-1:-1:-1";
		"ALLOW:G:WL:-1:-1:-1:-1"; // G=global, WL=Whitelist
		"ALLOW:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1";
		"ALLOW:$policy_id:WL:-1:-1:-1:-1";
		"DENY:0:-1:-1:-1:-1:-1";
		"DENY:G:BL:-1:-1:-1:-1";
		"DENY:$policy_id:BL:-1:-1:-1:-1";
		"DENY:$policy_id:$genes_vector:-1:-1:-1:-1";
		"SS:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1";
		"YT:$policy_id:$genes_vector:$keyword_scanning:$yt_sm:$yt_edu:$yt_edu_string";
		"GM:$policy_id:$genes_vector:$keyword_scanning:$gm_sm_string:-1:-1";
		"PAUSE:998:-1:-1:-1:-1:-1";

		*/

		var actionStr = respArr[0];
		var policyStr = respArr[1];
		var categoryStr = respArr[2];
		var keywordScanStr = respArr[3];
		var ytSSStr = respArr[4];
		var ytEduStr = respArr[5];
		var ytEduAccStr = respArr[6];

        // If this is an iFrame that is blocked CANCEL the request to
        // prevent site leaking.
        if (this.iframeResp.length > 0) {
            if (this.iframeResp[0] == "DENY") {
                this.iframeResp = "";
                return {redirectUrl: this.iframeBlockUrl};
            }
        }

		/* Removed DENY for ERROR cases. ERROR means ALLOW now. This was because of issues with Captive portals. */
		if ( actionStr == "DENY" )
		{
			return takeDenyAction(policyStr, categoryStr, b64Url);
		}

		if ( actionStr == "PAUSE" )
		{
			return getPauseAction(b64Url);
		}

		// check if safe search or common creative image search is on
		var isSSOrCC = false;

		if (actionStr == "SS") {
			rawInfoURL = takeSafeSearchAction(lHostName, rawInfoURL);
			isSSOrCC = true;
		}

		// creative common search
		if (categoryStr == "CC") {
			rawInfoURL = takeCreativeCommonImageSearchAction(rawInfoURL);
			isSSOrCC = true;
		}

		// if safe search of common creative image search is checked, redirect to the new url
		if (isSSOrCC === true) {
			return {redirectUrl: rawInfoURL};
		}

		// YT action moved to onbeforesendheaders()

		return; // Default Allow
	}
}