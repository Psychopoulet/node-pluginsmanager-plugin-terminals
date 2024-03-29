"use strict";

// deps

	// natives
	const { join } = require("path");
	const { request } = require("http");
	const { parse } = require("url");

	// externals
	const express = require("express");
	const WebSocket = require("ws");

	// locals
	const getDescriptorServerUrl = require(join(__dirname, "getDescriptorServerUrl.js"));
	const getDescriptorSocketServerUrl = require(join(__dirname, "getDescriptorSocketServerUrl.js"));

// module

module.exports = class TestServer {

	constructor () {

		this._mainUrl = "";
		this._runningServer = null;

		this._runningWebsocketServer = null;
		this._websocketClient = null;

	}

	init (orchestrator) {

		return Promise.resolve().then(() => {

			return getDescriptorServerUrl().then((url) => {

				this._mainUrl = url;

				return new Promise((resolve) => {

					const app = express().use((req, res, next) => {
						orchestrator.appMiddleware(req, res, next);
					}).use((req, res) => {

						res.writeHead(404, {
							"Content-Type": "text/plain; charset=utf-8"
						});

						res.end(JSON.stringify("Unknown path"));

					});

					const { port } = parse(url);

					this._runningServer = app.listen(parseInt(port, 10), resolve);

				});

			});

		}).then(() => {

			return getDescriptorSocketServerUrl().then((url) => {

				const { port } = parse(url);

				this._runningWebsocketServer = new WebSocket.Server({
					"port": parseInt(port, 10)
				});

				orchestrator.socketMiddleware(this._runningWebsocketServer);

				this._websocketClient = new WebSocket(url);

			});

		});

	}

	release () {

		return Promise.resolve().then(() => {

			return this._runningServer ? new Promise((resolve) => {

				this._runningServer.removeAllListeners();

				this._runningServer.close(() => {
					this._runningServer = null;
					resolve();
				});

			}) : Promise.resolve();

		}).then(() => {

			return this._runningWebsocketServer ? new Promise((resolve) => {

				this._runningWebsocketServer.removeAllListeners();

				this._runningWebsocketServer.close(() => {
					this._runningWebsocketServer = null;
					resolve();
				});

			}) : Promise.resolve();

		}).then(() => {

			if (this._websocketClient) {
				this._websocketClient.removeAllListeners();
				this._websocketClient = null;
			}

		});

	}

	request (urlpath, method = "get", params) {

		return new Promise((resolve, reject) => {

			const url = parse(this._mainUrl + urlpath);
			const bodyParams = "undefined" !== typeof params ? JSON.stringify(params) : "";

			const opts = {
				"protocol": url.protocol,
				"hostname": url.hostname,
				"port": url.port,
				"path": url.path,
				"query": url.query,
				"method": method.toUpperCase(),
				"headers": {
					"Content-Type": "application/json; charset=utf-8",
					"Content-Length": Buffer.byteLength(bodyParams)
				}
			};

			const req = request(opts, (res) => {

				res.setEncoding("utf8");

				let rawData = "";
				res.on("data", (chunk) => {
					rawData += chunk;
				}).on("end", () => {
					resolve(rawData);
				});

			});

			req.on("error", reject);

			req.write(bodyParams);
			req.end();

		}).then((content) => {

			if (content.length) {
				return Promise.resolve(JSON.parse(content));
			}
			else {
				return Promise.resolve();
			}

		});

	}

	onMessage (callback) {

		this._websocketClient.on("message", (data) => {
			callback(JSON.parse(data));
		});

	}

	removeMessageListeners () {

		this._websocketClient.removeAllListeners("message");

	}

};
