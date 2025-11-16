module.exports = function(RED) {
    "use strict";

    function IoTextraInputNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.broker = RED.nodes.getNode(config.broker);

        if (node.broker) {
            const inputTopic = `${config.baseTopic}/input/${config.channel}`;

            const onConnected = () => {
                node.status({ fill: "green", shape: "dot", text: "connected" });
                node.log(`Connection established. Subscribing to: ${inputTopic}`);
                node.broker.subscribe(inputTopic, 2, (topic, payload, packet) => {
                    const val = payload.toString();
                    let out_payload;
                    out_payload = val;
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
            node.log("trying to register");
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

            node.on('close', (done) => {
                if (node.broker) {
                    node.broker.deregister(node, done);
                } else {
                    done();
                }
            });
        } else {
            node.status({ fill: "red", shape: "ring", text: "broker not configured" });
        }
    }

    RED.nodes.registerType("iotextra-input", IoTextraInputNode);
};