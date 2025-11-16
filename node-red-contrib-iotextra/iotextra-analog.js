module.exports = function(RED) {
    "use strict";

    function IoTextraAnalogNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.broker = RED.nodes.getNode(config.broker);

        if (node.broker) {
            const analogTopic = `${config.baseTopic}/analog/${config.channel}`;

            const onConnected = () => {
                node.status({ fill: "green", shape: "dot", text: "connected" });
                node.log(`Connection established. Subscribing to: ${analogTopic}`);
                node.broker.subscribe(analogTopic, 2, (topic, payload, packet) => {
                    const val = payload.toString();
                    let out_payload;
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal)) {
                        out_payload = numVal;
                    } else {
                        out_payload = val;
                    }
                    node.log(`Received analog value: ${out_payload} on topic: ${topic}`);
                    node.send({ payload: out_payload, topic: topic, qos: packet.qos, retain: packet.retain });
                }, node.id);
            };

            const onDisconnected = () => {
                node.status({ fill: "red", shape: "ring", text: "disconnected" });
            };

            const onBrokerRegister = () => {
                onConnected();
                if (node.broker.connected) {
                    onConnected();
                } else {
                    onDisconnected();
                }
                node.broker.on('connected', onConnected);
                node.broker.on('disconnected', onDisconnected);
            };

            node.log("trying to register");
            if (node.broker.register) {
                node.broker.register(node);
                onBrokerRegister();
            } else {
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

    RED.nodes.registerType("iotextra-analog", IoTextraAnalogNode);
};