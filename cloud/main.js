// Use AV.Cloud.define to define as many cloud functions as you want.
// For example:


var itunesProductionHost = "https://buy.itunes.apple.com/verifyReceipt";
var itunesSandboxHost = "https://sandbox.itunes.apple.com/verifyReceipt";
var sharedSecret = "3b70e05e15f24218bda1521ae1ccbdaa";

var DISCOUNT_TYPE_CAMPAIGN = "campaign";
var DISCOUNT_TYPE_NORMAL = "normal";

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
	//console.log("[RegisterPlayer]");
	
	var deviceId = request.params.deviceId;
	
	var saveData = request.params.saveData;
	
	var prefData = request.params.prefData;
	
	var hasRequestCache = request.params.hasRequestCache;
	
	var playerObjId = request.params.playerObjId;
	
	
	var PlayerData = AV.Object.extend("PlayerData");
	
	//console.log("deviceId: " + deviceId);
	
	//console.log("hasRequestCache: " + hasRequestCache);
	
	//console.log("playerObjId: " + playerObjId);
	
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
	
	var currPlayer;
	
	query.find().then(
		function(objects)	
		{	
			if(objects.length==0)
			{
				//console.log("to create new player");
				
				//console.log("saveData: " + saveData);
				
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
				
				//console.log("get old player");
				
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
	
	//console.log("isSandbox: " + isSandbox);
	
	//console.log("receipt: " + receipt);
	
	var host;
	
	if (isSandbox == "true")
		host = itunesSandboxHost;
	else
		host = itunesProductionHost;
		
	//console.log("host: " + host);
	
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

// define a background running job for the discount arrangement
AV.Cloud.setInterval("ArrangeDiscounts", 180, function() {
//AV.Cloud.define("ArrangeDiscounts",function(request,response){
		
	
	var currPlayer;
	var currDiscount;
	
	var currDuring;
	var currStartTime;
	var currDiscountType;
	
	var currTime = new Date();	
	
	
	var query = new AV.Query("Discount");
	
	query.equalTo("expired", false);
	
	query.each(
		function(discount)
		{
			
			console.log("each discount");
			
			currDiscount = discount;
			
		   	// during in seconds
		   	var during = discount.get("during");
			currDuring = during;
			
			
		   	var startTime = discount.get("startTime");
			currStartTime = startTime;
			
			currDiscountType = discount.get("discountType");
		
			// if a discount is going to be expired, just set the expired field as true
			// otherwise, we check if there are associated records for targets players
			// if not, bind this discount and player as a record, and then add it to database
		   	if( (currTime - startTime)/1000 >= during)
		   	{
				discount.set("expired", true);
			
			
				// pass 1
				//console.log("promise 1 pass 1");
			
				return discount.save();	
			}
			else
			{
			   	var targets = discount.get("targets");	
			
				//console.log("not expired");
				
				//console.log("targets: " + JSON.stringify(targets));
			
				// length equal to 0 means that we need offer this discount to all players
				var playerQuery = new AV.Query("PlayerData");
				
				if (targets != null && targets.length > 0)
				{
					//console.log("contain targets");
					playerQuery.containedIn("objectId", targets);
				}
				
				//pass 2	
				//console.log("promise 1 pass 2");
				
				var promisePlayerQuery = playerQuery.each(
					function(player)
					{	
						currPlayer = player;
			
						var recordQuery = new AV.Query("DiscountRecord");
		 
						recordQuery.equalTo("player", player);
						recordQuery.equalTo("discount", discount);
				
						//console.log("promise 2 pass 1");
						
						var promiseRecordQuery = recordQuery.find();
						
						var nextPromise = new AV.Promise();
						
						promiseRecordQuery.then(
							function(objects)
							{
								if(objects.length == 0)
								{
									// create a record for this player and discount
									
									var DiscountRecord = AV.Object.extend("DiscountRecord");
									
									var newRecord = new DiscountRecord();

									newRecord.set("player", currPlayer);
									newRecord.set("discount", currDiscount);
									newRecord.set("startTime", currStartTime);
									newRecord.set("expired", false);
									
									if(currDiscountType == DISCOUNT_TYPE_CAMPAIGN)
									{		
										var endTime = new Date(currStartTime.getTime() + currDuring * 1000);

										newRecord.set("endTime", endTime);
									}
													
									//console.log("promise 3 pass 1");
									//console.log("try to create new record!");
									
									newRecord.save(
										null,
										{
					  						success: function(record)
												{
													//console.log("new record created");
													nextPromise.resolve(record);
												},
											error: function(record, error) 
												{
													
													// for (var key in error) {
// 														console.log("key: " + key + " value: " + error[key]);
// 													  // do something with key
// 													}
													//console.log("faile to create new record! error: " + error.message + " record: " + record);
													nextPromise.reject(error.description);
												}
										}
									);
									
									return nextPromise
								}
								else
								{
									//console.log("promise 3 pass 2");
									
									nextPromise.resolve("skip done");
									
									return nextPromise
								}
							}
						);
						
						return AV.Promise.when(promiseRecordQuery, nextPromise);
					}
				);
				
				return promisePlayerQuery;
			}
		}
	).then(
		function(message)
		{
			//response.success("discount arrangment finished! message: " + message);
			console.log("discount arrangment finished! message: " + message);
		},
	
		function(error)
		{
			//response.error("Uh oh, something went wrong." + error);
			console.log("Uh oh, something went wrong." + error.message);
		}		
	); 	
	
});

// Type campaign
AV.Cloud.define("CheckDiscount", function(request, response)
{
	var playerObjId = request.params.playerObjId;
	
	if (playerObjId == null || playerObjId == "" || playerObjId == "null")
	{
		response.error("check discount failed playerObjId is undefined");
	}
	
	//console.log("playerObjId: " + playerObjId);
	
	var PlayerData = AV.Object.extend("PlayerData");
	
	var playerDummy = new PlayerData();
	playerDummy.id = playerObjId;
	
	
	var discountRecordBucket = new Array();
	
	var currTime = new Date();	

	var recordQuery = new AV.Query("DiscountRecord");
	
	recordQuery.equalTo("player", playerDummy);
	recordQuery.equalTo("expired", false);
	
	//recordQuery.include("player");
	recordQuery.include("discount");
	
	recordQuery.each(
		function(record)
		{
			console.log("each record");
			
			var discount = record.get("discount");
			
			var type = discount.get("discountType");
			
			var during = discount.get("during");
			
			//console.log("during: " + during);
			
			var endTime = record.get("endTime");
			
			//console.log("endTime: " + endTime);
			
			var startTime = record.get("startTime");
			
			//console.log("startTime: " + startTime);
			
			
			if(currTime < startTime)
			{
				
				//console.log("not start yet");
				
				return AV.Promise.as("skip done");
			}
			
			if (endTime != null)
			{
				
				var endTime = record.get("endTime");
			
				// determine if the record would be expired
				if (currTime >= endTime)
				{
					record.set("expired", true);
					
					//console.log("already expired flag it!");
				
					return record.save();
				}
				else
				{	
					var set = {
						record:record,
						discount:discount	
					}
					
					
					discountRecordBucket.push(set);
					
					//console.log("not expired add it!");
					
					return AV.Promise.as("skip done");
				}
			}
			else
			{
				if (type == DISCOUNT_TYPE_NORMAL)
				{
				
					var newEndTime = new Date(currTime.getTime() + during * 1000);
			
					record.set("endTime", newEndTime);
					
					var set = {
						record:record,
						discount:discount	
					}
					
					discountRecordBucket.push(set);
					
					//console.log("not expired add it!");
					//console.log("create new endTime");
					
				
					return record.save();
				}
				else
				{
					
					//console.log("not expired add it!");
					
					return AV.Promise.error("unexpected error");
				}
			}		
			
		}
	).then(
		function(object)
		{
			
			//console.log("iterated all associated records message: " + object);
			
			var myJsonString = JSON.stringify(discountRecordBucket);

		   	//console.log("myJsonString: " + myJsonString);

		   	response.success(myJsonString);
			
		},
		
		function(error)
		{	
         	//console.error("Error finding related comments " + error.code + ": " + error.message);
		 	response.error("check discount failed");	
		}
	);
	
});