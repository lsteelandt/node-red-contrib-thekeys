
var request = require('request');
var CryptoJS = require("crypto-js");

const  minDelayCheckStatus=30;

/**
* ====== thekeys-lock ================
* ===========================================
*/
module.exports = function(RED) {
    function thekeysLockNode(config) {
        RED.nodes.createNode(this,config);
  		var node = this;
        node.name = config.name;
        node.identifier=config.identifier;
		node.sharecode=config.sharecode;
		node.periodReadingState = config.periodReadingState||minDelayCheckStatus;
		//check if Reading State period is at least 30sec
		if (node.periodReadingState<minDelayCheckStatus || isNaN(node.periodReadingState))
				{
					 node.periodReadingState=minDelayCheckStatus;
					 config.periodReadingState=minDelayCheckStatus;
					 node.log("periodReadingState too low, set to 30sec");
				}

		var thekeysGateway = RED.nodes.getNode(config.controller);
		//var lockState="unknown";
		var lockState = this.context().get('lockState')||"unknown";
		var ProcessingCommand=false;
		
        var CheckStatusFunctionId;
  
        function sendCommandToGateway(command)
        {
            node.log("dans sendCommandToGateway");
			node.log("name="+node.name+" identifier="+node.identifier+" sharecode="+node.sharecode +"command="+command+" processing command ?="+ProcessingCommand);
			if(ProcessingCommand==false)
			{
				ProcessingCommand=true;
				if ( command != undefined )
				{	
					node.status({fill:"yellow", shape: "ring", text: "processing"	});
					node.log("sendCommandToGateway thekeysGateway.checkState="+thekeysGateway.checkState+"  lockState="+lockState+"   command="+command);
					//Check if the Gateway is configured to allowed posting command without considering current state of Lock
					// and control if the command try to send a unusefull command (open to an opened lock, close to a closed lock)
					if ( thekeysGateway.checkState)
					{
						//if an unusefull command is ordered, then the command is transformed to a get status command
						if ( (command=="open" && lockState=="opened") || (command=="close" && lockState=="closed") )
							command="locker_status";
					}

					// execute the appropriate http POST to send the command to thekeys gateway
					// and update the node's status according to the http response
					
					thekeysGateway.control(
										node.identifier,
										node.sharecode,
										command,
										function(body) {
											//node.log("dans function(body)");
											var res = JSON.parse(body);
											status=res["status"];

											if (command=="open")
											{
												if (status=="ok")
													lockState="opened";
												else
													lockState="jammed";
											}
											else if (command=="close")
											{
												if (status=="ok")
													lockState="closed";
												else
													lockState="jammed";
											}	
											else if (command=="locker_status")
											{
												if (status=="Door open")
														lockState="opened";
												else if (status=="Door closed")
														lockState="closed";
												else												
														lockState="jammed";
											}
											
											node.status({ fill: "green", shape: "dot", text: lockState });

											node.send(
												[
													{payload:{ "command": command, "status": res["status"]} },
													{payload:lockState}
												]
												);
											
	
										},
										function(err) {
											//node.log("dans function(err)");
											node.warn(err);

											var res = JSON.parse(err);
											if (res.code==37) lockState="jammed";

											node.status({fill:"red", shape: "ring", text: lockState	});
											node.send([{payload:{"command":command,"status":err} },{payload:lockState}]);										
										}
					);
					
				}
				else
				{
					// no command specified !
					node.status({fill:"red", shape: "ring", text: "no command specified"});
					return "onInput: no command specified";
				}

				ProcessingCommand=false;
			}
			else node.log("processing commande. Avoid new command");
        }
 
		this.on('input', function(msg) {
			sendCommandToGateway(msg.payload);
			//this.send(msg);
			});
	
            
        this.getConfig = function () {
			return config;
		}

        this.log(JSON.stringify(config));
       	
       	this.on("close", function() {
            this.log('close');
            //arrêt de l'interrogation périodique du status. 
            clearInterval(CheckStatusFunctionId);

		});
     
         //laisse 5 seconde avant de programmer un check périodique de l'état de la serrure tous les 5sec
        setTimeout(function() {
								node.log("setTimeout::node.periodReadingState="+node.periodReadingState);
            					CheckStatusFunctionId = setInterval(function() {sendCommandToGateway("locker_status")}, node.periodReadingState*1000);
        					  }, 5000);
 
    }
    RED.nodes.registerType("thekeys-lock",thekeysLockNode);

	/**
	* ====== thekeys-gateway ================
	* Holds the hostname and port   
	* of theKeys Gateway
	* ===========================================
	*/

	function getConnectionString(config) {
		var url;
		
		if ( config.protocol )
			url = config.protocol;
		else
			url = "http";
		
		url += "://";
	
		url +=  config.host;
		
		if ( (config.port != undefined) && (config.port.trim().length != 0) )
		{
			url += ":" + config.port.trim();
		}
		return url+"/";
	}

	function thekeysGateway(config) {
		RED.nodes.createNode(this, config);
		var node = this;
		node.checkState = config.checkState;

		this.getConfig = function () {
			return config;
		}

		node.log(JSON.stringify(config));
		
		// this controller node handles all communication with the configured theKeys gateway 
        this.control = function(identifier, sharecode, payload, okCb, errCb) {
			var command=payload;
            var url = getConnectionString(config) + command;
            var headers = {'content-type' : 'application/x-www-form-urlencoded'} ;
            var ts = ""+Math.floor(Date.now() / 1000);
            var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(ts, sharecode));
            
            var body= 'identifier='+identifier+ '&ts='+ ts + '&hash=' + hash;

            node.log(JSON.stringify({url: url, body: body}));
            
			request.post({url: url, body: body}, function(error, response, body) {
        		if ( error )
        		{
					node.emit('CommunicationError', error);
        			errCb(JSON.stringify({"status":"ko","code":99,"details":"request error " + error,"url": url + "'"}));					
        		}
        		else
        		{
					//node.log(JSON.stringify(body));
					try
					{
						var res = JSON.parse(body);
					}
					catch(error)
					{
						node.log("Parsing Error while decoding gateway response : "+error);
						res=JSON.parse('{"status":"ko", "code":99}');						
					}					

                    if(res.status=="ko")
                    {
                        errCb(JSON.stringify({"status":"ko","code":res.code,"url":url}));
                    }
                    else
                        okCb(body);
        		}
        	});
			
		};
		
		function startEventSource() {
			var url = getConnectionString(config) + "lockers";
			request.get(url, function(error, response, body) {
				// handle communication errors
				if ( error ) {
					node.warn("request error '" + error  + "' on '" + url + "'");
					node.emit('CommunicationError', error);
				}
				else if ( response.statusCode != 200 ) {
					node.warn("response error '" + JSON.stringify(response) + "' on '" + url + "'");
					node.emit('CommunicationError', response);
				}
				else {
					// Get Lockers associated
					node.emit('CommunicationStatus', "ON");
					var res = JSON.parse(body);
                    var Associations = res["devices"];
                    
                   
					Associations.forEach(function(lock) {
						console.log("lock id="+lock.identifier+" associated");
						node.log("lock id="+lock.identifier+" associated");
					});
					
				}
			});
					
		}
		
		// give the system few seconds 
		setTimeout(function() {
			startEventSource();
		}, 3000);

		
		this.on("close", function() {
			node.log('close');
			node.emit('CommunicationStatus', "OFF");
		});

	}
    RED.nodes.registerType("thekeys-gateway", thekeysGateway);
}
