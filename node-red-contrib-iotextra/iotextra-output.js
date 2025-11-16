module.exports = function(RED) {
    "use strict";

    function IoTextraOutputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Retrieve the broker configuration node
        node.broker = RED.nodes.getNode(config.broker);

        if (node.broker) {
            const stateTopic = `${config.baseTopic}/output/${config.channel}/state`;
            const onConnected = () => {
                node.status({ fill: "green", shape: "dot", text: "connected" });
                // Subscribe to the state topic only when connected
                node.log(`Subscribing to topic: ${stateTopic}`);
                node.broker.subscribe(stateTopic, 1, (topic, payload, packet) => {
                    const val = payload.toString();
                    let out_payload;
                    if (val === '1') {
                        out_payload = true;
                    } else if (val === '0') {
                        out_payload = false;
                    } else {
                        out_payload = val;
                    }
                    node.log(`Received state: ${out_payload} on topic: ${topic}`);
                    node.send({ payload: out_payload, topic: topic, qos: packet.qos, retain: packet.retain });
                }, node.id);
            };

            const onDisconnected = () => {
                node.status({ fill: "red", shape: "ring", text: "disconnected" });
            };

            // This handler ensures we are notified when the broker is ready
            const onBrokerRegister = () => {
                onConnected();
                if (node.broker.connected) {
                    onConnected();
                } else {
                    onDisconnected();
                }
                // Register the main listeners now that the broker is ready
                node.broker.on('connected', onConnected);
                node.broker.on('disconnected', onDisconnected);
            };
            // Set initial status and register listeners using the robust register/deregister pattern
            if (node.broker.register) {
                node.broker.register(node);
                onBrokerRegister(); // Call once to set initial state
            } else {
                // Fallback for older broker nodes
                node.broker.on('connected', onConnected);
                node.broker.on('disconnected', onDisconnected);
                if (node.broker.connected) {
                    onConnected();
                } else {
                    onDisconnected();
                }
            }

            node.on('input', (msg, send, done) => {
                if (node.broker && node.broker.connected) {
                    const state = (msg.payload === true || msg.payload === 1) ? '1' : '0';
                    const topic = `${config.baseTopic}/output/${config.channel}/set`;
                    
                    node.broker.publish({
                        topic: topic,
                        payload: state,
                        qos: 1,
                        retain: true
                    });
                }
                if (done) {
                    done();
                }
            });

            // Clean up listeners and subscriptions when the node is closed
            node.on('close', (done) => {
                if (node.broker) {
                    if (node.broker.deregister) {
                        // The deregister function will handle unsubscribing, removing listeners, and calling done().
                        node.broker.deregister(node, done);
                    } else {
                        // Fallback for older brokers: manually clean up.
                        node.broker.removeListener('connected', onConnected);
                        node.broker.removeListener('disconnected', onDisconnected);
                        node.broker.unsubscribe(stateTopic, node.id, done);
                    }
                } else {
                    done();
                }
            });

        } else {
            // If no broker is configured, set an error status
            node.status({ fill: "red", shape: "ring", text: "broker not configured" });
        }
    }

    RED.nodes.registerType("iotextra-output", IoTextraOutputNode);
};