/*
	Create a SYNCHRONOUS (BLOCKING) XMLHttpRequest
*/
function createBlockingRequest(method, url)
{
	var hdl = new XMLHttpRequest();
	hdl.open(method, url, false); // False makes it blocking
	return hdl;
}

/*
	Create a A-SYNCHRONOUS (NON-BLOCKING) XMLHttpRequest
*/
function createNonBlockingRequest(method, url)
{
	var hdl = new XMLHttpRequest();
	hdl.open(method, url, true); // True makes it non-blocking
	return hdl;
}