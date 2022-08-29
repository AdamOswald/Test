// Fetch cluster the userEmail belongs to OR redirect to sign up page.
function fetchClusterUrl() {
  var domain = (window.userEmail.split("@"))[1];
  var url = checkClusterURL + "/crextn/cluster?domain=" + domain;
  var request = createBlockingRequest("get", url);
  var clusters = localStorage.getItem("cluster");
  if (clusters) {
    clusters = clusters.split(",");
    if (clusters.length == 2) {
      var timeDiff = 0;
      timeDiff = (new Date().getTime() / 1000) - clusters[1];
      if (timeDiff < 365 * 24 * 60 * 60) {
		window.clusterUrl = clusters[0];
		if (window.clusterUrl == "UNKNOWN_SCHOOL") {
			window.clusterFound = window.clusterStatus.UNKNOWN_SCHOOL;
		} else if (window.clusterUrl == "AVOID_OS") {
			window.clusterFound = window.clusterStatus.AVOID_OS;
		} else {
			window.clusterFound = window.clusterStatus.FOUND;
		}
        setupIWF();
        return;
      }
    }
  }
	request.onreadystatechange = function() {
		if (request.readyState == 4 && request.status == 200) {

			// remove the embedded IWF code from response, setup the debugIWF value
			// based on the debugIWF value, we clear / update the local storage
			var clusterResp = request.responseText.trim();
			window.debugIWF = 0;
			if (clusterResp.lastIndexOf("_disableIWF") !== -1) {
				window.clusterUrl = clusterResp.slice(0, clusterResp.lastIndexOf("_disableIWF"));
				window.debugIWF = 1;
				localStorage.clear();
			} else if (clusterResp.lastIndexOf("_updateIWF") !== -1) {
				window.clusterUrl = clusterResp.slice(0, clusterResp.lastIndexOf("_updateIWF"));
				window.debugIWF = 2;
				downloadIWFList();
			} else {
				window.clusterUrl = clusterResp;
        localStorage.setItem("cluster", window.clusterUrl + "," + new Date().getTime() / 1000);
			}
			window.clusterFound = window.clusterStatus.FOUND;
			setupIWF();

			if ( window.clusterUrl == "UNKNOWN_SCHOOL" )
			{
				window.clusterFound = window.clusterStatus.UNKNOWN_SCHOOL;
				return;
			}

			if ( window.clusterUrl == "AVOID_OS" )
			{
				window.clusterFound = window.clusterStatus.AVOID_OS;
				return;
			}

		} else {
			// alert("FATAL: Unexpected error in locating school.");
			window.clusterFound = window.clusterStatus.ERROR;
			return;
		}
	};

	try {
		request.send();
	}
	catch (err) {
		console.log("Send error uc4");
	}

	if (forceClusterUrl === true) {
		window.clusterUrl = DEBUG_clusterUrl;
		window.clusterFound = 1;
	}

	setupOrReload();
}

// use new chrome api to get the user email of current logged in user
function fetchUserAPI() {
	chrome.identity.getProfileUserInfo(function(info) {
		var kidEmail = info.email;

		// debug part for fake user email and cluster url
		if (forceUserEmail === true) {
			kidEmail = DEBUG_userEmail;
		}

		// if user already signed in to chrome
		if (kidEmail !== "") {
			window.userEmail = kidEmail;
			window.userFound = window.userStatus.FOUND;
			checkUserInfo();
		} else {
			window.clusterFound = window.clusterStatus.AVOID_OS;
			window.clusterUrl = "AVOID_OS_";
		}
	});

	function checkUserInfo() {
		fetchClusterUrl();
		return;
	}
}
