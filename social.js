function getSocialPost(info, info_url) {
	var b64Msg = "";
	// buff is byte array that sometimes the formData will be encoded into byte array
	// content is the string format of the byte array
	var buff = null;
	var content = "";

	// get tweet
	if (info.url.indexOf("twitter.com") != -1 &&
		info.url.indexOf(window.twitterMessageURI) != -1 &&
		info.method == "POST" && info.type == "xmlhttprequest") {

		var tweet = "";
		// if tweet has "~", it is encoded in array buffer, just like fb
		if (info.requestBody.raw !== undefined) {
			buff = info.requestBody.raw[0].bytes;
			content = buff2Str(buff);
			tweet = extractPost(content, "&status=", "&tagged_users");
			// replace the new line flag with "\n"
			tweet = tweet.replace(/%0A/gi, "%5Cn");
			b64Msg = window.btoa(decodeURIComponent(tweet.toLowerCase()));
		} else {
			tweet = info.requestBody.formData.status[0];
			// replace the new line flag with "\n"
			tweet = encodeURIComponent(tweet);
			tweet = tweet.replace(/%0A/gi, "%5Cn");
			b64Msg = window.btoa(decodeURIComponent(tweet.toLowerCase()));
		}
	}

	// get facebook post
	if (info_url.indexOf("facebook.com") != -1 &&
		(info_url.indexOf("updatestatus") != -1 || 
		info_url.indexOf('webgraphql') != -1
		) &&
		info.method == "POST" && info.type == "xmlhttprequest") {
		buff = info.requestBody.raw[0].bytes;
		content = buff2Str(buff);
		var fbPost = extractFBPost(decodeURIComponent(content));
		
		// replace the new line flag with "\n"
		//fbPost = fbPost.replace(/%0A/gi, "%5Cn");
		b64Msg = window.btoa(fbPost.toLowerCase());
	}

	if (info_url.indexOf("facebook.com") != -1 &&
		info_url.indexOf("api/graphql") != -1 &&
		info.method == "POST" && info.type == "xmlhttprequest") {
		var fbPost = extractFBPostV2(info.requestBody.formData);
		if(fbPost === false) {
			//Do not broker current FB request if no post content found in request.
			return fbPost;
		}
		b64Msg = window.btoa(fbPost.toLowerCase());
	}

	// get google plus post
	if (info_url.indexOf("google.co") != -1 &&
		info_url.indexOf("/PlusAppUi/mutate") != -1 &&
        info.method == "POST" && info.type == "xmlhttprequest") {
		
		var gPlusPost = "";
		// same as twitter, if the post has char "~", it will be encoded in array buffer
		// the reason why g+ convert " to \" is that " will cost some misunderstanding in url encoding
		if(info.requestBody.raw !== undefined) {
        	buff = info.requestBody.raw[0].bytes;
			content = buff2Str(buff);
			gPlusPost = extractPost(content, 'f.req=%5B%22', '%22%2C%22oz');
			b64Msg = window.btoa(decodeURIComponent(gPlusPost.toLowerCase()));
		} else {
            var gPlusData = info.requestBody.formData["f.req"][0];

            // This id defines request is google plus status
            if(gPlusData.indexOf('79255737') !== -1) {
            	gPlusPost = extractPost(gPlusData, '[[[0,"', '"]]],null');
                console.log(gPlusPost);
                // convert % to %25 to avoid decodeURI failed, decodeURI will try to decode every substring starts with %
    			gPlusPost = gPlusPost.replace("%", "%25");
    			b64Msg = window.btoa(decodeURIComponent(gPlusPost.toLowerCase()));
            }
		}
	}

	return b64Msg;
}

// array buffer to string, for facebook post / tweet and G+ post having "~"
function buff2Str(buff) {
	return String.fromCharCode.apply(null, new Uint8Array(buff));
}

// extract required post from the formData string
function extractPost(str, startTag, endTag) {
	var startPos = str.indexOf(startTag) + startTag.length;
	var endPos = str.indexOf(endTag);
	return str.substring(startPos, endPos);
}


function extractFBPost(str) {
    var params = {}, queries, temp, i, l;
    // Split into key/value pairs
    queries = str.split("&");
    // Convert the array of strings into an object
    for ( i = 0, l = queries.length; i < l; i++ ) {
        if(queries[0].indexOf("variables=") == 0){
            return JSON.parse(queries[0].substr(10)).input.message.text;
        }
    }
}
/*
 * Retrieves DDB post data from input params.
 * Need to write in seperate function as retrieval methods are diffrent. 
 */
function extractFBPostV2(params) {
	var inputParams = JSON.parse(params.variables)
	try {
		if(inputParams.input.composer_type == "feed" && inputParams.input.message.text) {
			return inputParams.input.message.text;
		}
	} catch(error) {
		return false;
	}
	return false;
}