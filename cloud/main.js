// Use AV.Cloud.define to define as many cloud functions as you want.
// For example:


var itunesProductionHost = "https://buy.itunes.apple.com/verifyReceipt";
var itunesSandboxHost = "https://sandbox.itunes.apple.com/verifyReceipt";
var sharedSecret = "3b70e05e15f24218bda1521ae1ccbdaa";

var responseCodes = {
    0: {
      message: "Active",
      valid: true,
      error: false
    },
    21000: {
      message: "App store could not read",
      valid: false,
      error: true
    },
    21002: {
      message: "Data was malformed",
      valid: false,
      error: true
    },
    21003: {
      message: "Receipt not authenticated",
      valid: false,
      error: true
    },
    21004: {
      message: "Shared secret does not match",
      valid: false,
      error: true
    },
    21005: {
      message: "Receipt server unavailable",
      valid: false,
      error: true
    },
    21006: {
      message: "Receipt valid but sub expired",
      valid: false,
      error: false
    },
    21007: {
      message: "Sandbox receipt sent to Production environment",
      valid: false,
      error: true,
      redirect: true
    },
    21008: {
      message: "Production receipt sent to Sandbox environment",
      valid: false,
      error: true
    }
}

AV.Cloud.define("RegisterPlayer", function(request, response)
{
	console.log("[RegisterPlayer]");
	
	var deviceId = request.params.deviceId;
	
	var saveData = request.params.saveData;
	
	var prefData = request.params.prefData;
	
	var hasRequestCache = request.params.hasRequestCache;
	
	var playerObjId = request.params.playerObjId;
	
	
	var PlayerData = AV.Object.extend("PlayerData");
	
	console.log("deviceId: " + deviceId);
	
	console.log("hasRequestCache: " + hasRequestCache);
	
	console.log("playerObjId: " + playerObjId);
	
	var query = new AV.Query("PlayerData");
	
	var isPlayerObjIdPrior = false;
	
	if(playerObjId != null && playerObjId != "" && playerObjId != undefined && playerObjId != "undefined")
	{
		isPlayerObjIdPrior = true;
		
		query.equalTo("objectId", playerObjId);
	}
	else
	{
		query.equalTo("deviceId", deviceId);
	}
	
	query.find().then(
		function(objects)	
		{	
			if(objects.length==0)
			{
				console.log("to create new player");
				
				console.log("saveData: " + saveData);
				
				//create a new player for this deviceId
				var player = new PlayerData();
				
				player.set("deviceId", deviceId);
				
				if(!hasRequestCache)
				{
					player.set("saveData", saveData);
				
					player.set("preferenceData", prefData);
				}
				
				currPlayer = player;
				
				return player.save();
			}
			else
			{
				currPlayer = objects[0];
				
				console.log("get old player");
				
				if (isPlayerObjIdPrior)
				{
					currPlayer.set("deviceId", deviceId)
					
					return currPlayer.save();
				}
				else
				{
					return AV.Promise.as("skip done");
				}
			}
		}
	).then(
		function(obj)
		{		
			var myJsonString = JSON.stringify(currPlayer);
		   	response.success(myJsonString);
		},
		
		function(error)
		{
			response.error("register player failed message: " + error.message);	
		}
	);
	
});

AV.Cloud.define("IAPVerify", function(request, response)
{
	// Verify a receipt
	var receipt = request.params.receipt;
	
	var isSandbox = request.params.sandbox;
	
	console.log("isSandbox: " + isSandbox);
	
	console.log("receipt: " + receipt);
	
	var host;
	
	if (isSandbox == "true")
		host = itunesSandboxHost;
	else
		host = itunesProductionHost;
		
	console.log("host: " + host);
	
	AV.Cloud.httpRequest({
	  method: "POST",
	  url: host,
	  headers: {"Content-Type": "application/json"},
	  body: 
	  {
		  "receipt-data": receipt,
		  "password": sharedSecret
	  
	  },
	  success: function(httpResponse) {
		
		var obj = JSON.parse(httpResponse.text);
		
		var status = obj.status;

		var ret = responseCodes[status];
		
		response.success(JSON.stringify(ret));
	  },
	  error: function(httpResponse) {
		response.error('Request failed with response code ' + httpResponse.status);
	  }
	});
	
}); 

AV.Cloud.define("hello", function(request, response) {
  response.success("Hello world!");
});

AV.Cloud.define("GetDateTime",function(request,response){
	var d1=new Date();
	//response.success(d1.toString('yyyy-MM-dd'));
	response.success(d1.toISOString());
});