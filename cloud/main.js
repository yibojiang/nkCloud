// Use AV.Cloud.define to define as many cloud functions as you want.
// For example:
AV.Cloud.define("hello", function(request, response) {
  response.success("Hello world!");
});

AV.Cloud.define("GetDateTime",function(request,response){
	var d1=new Date();
	//response.success(d1.toString('yyyy-MM-dd'));
	response.success(d1.toString());
});