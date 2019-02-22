node-red-contrib-thekey
================================

This package contains nodes to communicate with lockers from the French theKeys' firm through its gateway product (https://store.the-keys.fr/en/accessories/11-gateway.html)

It's compose of :
- 1 configuration node `thekeys-gateway` that contains properties of the gateway use to pilot locks. 
- 1 node `thekeys-lock` that represent a lock to remotly pilot

# requirements
Thispackage depends on `crypto-js` and `request`nodes.

# thekeys-gateway
The configuration contains 4 properties :

**name** : the name you decide to give to the theKeys gateway

**host**:  the gateway IP adress. It can contains an hostname. Default value is`thekeys.local`

**port** (optional) : the port used to communicate with the gateway (in case of using NAT rules on router)

**checkState** : it define if you want the node to avoid posting to gateway an open (or close) command while the state of the desitnation lock is already opened (or closed). When checked (set to true), the node will not send open command to lock considered opened (stored state set to opened).
This will avoid unusefull url call to gateway and then will not charge it unusefully.
If this property is not checked (se to false), command will be post to gateway unconditionely.
  
# thekeys-lock 

## properties

**name**: Specify a name for the configuration node

**controller**: Select the config node corresponding to the gateway linked to the lock.

**identifier**: ID of lock to command. It correspond to the "ID serrure" stored in the table you can obtain in this url https://api.the-keys.fr/fr/compte/serrure

**sharecode**: Code of sharing between Gateway and Lock. Code obtain in you api.the-keys account at  https://api.the-keys.fr/fr/compte/partage/accessoire/< gateway ID >/get.

**periodReadingState**: Specify a delay in second between each periodicly state reading of the lock. Default value is 300 sec (5mins). Minimum value is 30sec.

## node input
The node can receive 3 commands on its input. Commands are strings with this allowed values : 
**open**: to unlock the locker
**close** : to lock the locker
**locker_status** : to get the locker state (opened=unlock, closed = lock). See outputs section below. 

## node outputs
### output n°1
First output, outputs JSON object containing the command posted and its result in this forrmat

```
{ 
"command": "open" or "closed" or "locker_status",
"status": a string describing the lock state or, in case of error, the string return by the http post command to gateway
}
```
exemple :
```json
{
"command":"locker_status",
"status":"Door closed"
}
```
### output n°2

Second output produce the lock state after command
It can be :
- `opened`
- `closed`
- `jammed`



