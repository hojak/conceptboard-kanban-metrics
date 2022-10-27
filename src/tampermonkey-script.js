// ==UserScript==
// @name         conceptboard metrics
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  add kanban metric buttons to concept board
// @author       Holger Janßen-Kroll
// @match        https://igus.conceptboard.com/*
// @grant        none
// @run-at       document-end
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==

// make sure to set the "match" clause to the domain of your conceptboard account

(function () {
	'use strict';

	require(["https://cdn.jsdelivr.net/npm/chart.js@2.9.4/dist/Chart.min.js"], function (Chart) {

		let colDone = "done";
		let colStart = "todo"; 
		let colLabel = "type";

		// Configurable variables:
		const metrics_prefix = "MetricsType";

		const column1 = [colDone, "#1F2D46"];
		const column2 = ['presenting', "#5C7793"];
		const column3 = ['doing', "#EFF1D3"];
		const column4 = [colStart, "#CBC198"];
		const column5 = ['options', "#924F31"];

		const dateColumns = [column1[0], column2[0], column3[0], column4[0], column5[0]];

		const cfdOptions = [
			[column1[0], column1[0], column1[1]],
			[column2[0], column2[0], column2[1]],
			[column3[0], column3[0], column3[1]],
			[column4[0], column4[0], column4[1]],
			[column5[0], column5[0], column5[1]],
		];

		const discardedColumn = 'discarded';

		const typeToColor = {
			// Kanban Cop work types
			"expedite": "#970909",
			"cop-card": "#1568D1",
		};

		const partition = [
			[2, "2h"],
			[8, "8h"],
			[24, "1d"],
			[48, "2d"],
			[120, "5d"],
			[240, "10d"],
			[10000, "> 10d"],
		];

		// logic for tampermonkey

		var kanbanDataHandler = function () {

			function workOnDates(data, checkDateColumns) {
				if (!checkDateColumns) {
					checkDateColumns = dateColumns;
				}

				return data.map(element => {
					Object.keys(element).forEach(function (key) {
						if (checkDateColumns.indexOf(key) >= 0) {
							element[key] = ensureStringIsDateTime(element[key]);
						}
					});

					return element;
				});

				return data;
			}

			function ensureStringIsDateTime(s, defaultTime) {
				if (!defaultTime) {
					defaultTime = "8:00";
				}

				if (!s) return null;

				if (s.match(/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}$/)) {
					return s;
				}

				if (s.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
					return s + " " + defaultTime;
				}

				if (s != "---" && !s.match("xxxx-xx-xx xx:xx")) {
					console.error("String " + s + " is not a datetime value!");
				}
				return null;
			}

			function removeDiscarded(data) {
				return data.filter(element => !element.discarded);
			}

			function transformToDateTime(data, workOnColumns) {
				if (!workOnColumns) {
					workOnColumns = dateColumns;
				}

				data = workOnDates(data, dateColumns);

				return data.map(element => {
					Object.keys(element).forEach(key => {
						if (element[key] && workOnColumns.indexOf(key) >= 0) {
							element[key] = Date.parse(element[key]);
						}
					});

					return element;
				});
			}

			function applyToDateValues(data, workOnColumns, f) {
				let columns = workOnColumns ? workOnColumns : dateColumns;
				return data.map(
					element => columns.map(key => element[key])
				).flatMap(e => e).reduce(f); // flatMap ?
			}

			function getMinDate(data, workOnColumns) {
				return applyToDateValues(data, workOnColumns, getMinNumber);
			}

			function getMaxDate(data, workOnColumns) {
				return applyToDateValues(data, workOnColumns, getMaxNumber);
			}

			function isNumber(a) {
				return typeof a === 'number' && isFinite(a);
			}

			function getMaxNumber(a, b) {
				return applyComparisonToNumbers(Math.max, a, b);
			}

			function getMinNumber(a, b) {
				return applyComparisonToNumbers(Math.min, a, b);
			}

			function applyComparisonToNumbers(f, a, b) {
				if (!isNumber(a) && !isNumber(b)) {
					return NaN;
				} else if (!isNumber(a)) {
					return b;
				} else if (!isNumber(b)) {
					return a;
				} else {
					return f(a, b);
				}
			}

			function addDoneTime(data) {
				return data.map(function (e) { if (!e.done) e.done = e["work end"]; return e; });
			}


			function init(metricColumns) {
				if (metricColumns) {
					dateColumns = metricColumns;
				}
			}

			return {
				applyComparisonToNumbers: applyComparisonToNumbers,
				getMinDate: getMinDate,
				getMaxDate: getMaxDate,
				transformToDateTime: transformToDateTime,
				addDoneTime: addDoneTime,
				init: init,
				removeDiscarded: removeDiscarded
			};
		}();

		if (typeof (module) !== 'undefined') {
			module.exports = kanbanDataHandler;
		}
		var modalCanvas = function () {
			let elementId = "modalCanvasDomElementId";

			function create() {
				clear();

				let div = document.createElement("div");
				div.setAttribute("style",
					"position: absolute; "
					+ "width: 80vw;"
					+ "height: 80vh;"
					+ "top: 10%; "
					+ "left: 10%; "
					+ "background-color: white;"
					+ "border: 1px solid black; "
					+ "padding: 5px; "
					+ "border-radius: 5px;"
					+ "z-index: 100000;"
				);
				div.setAttribute("id", elementId);

				let canvas = document.createElement("canvas");
				div.appendChild(canvas);
				canvas.setAttribute("id", elementId);

				let closeLink = document.createElement("a");
				closeLink.setAttribute("onClick", "return modalCanvas.clear()");
				closeLink.setAttribute("href", "#");
				closeLink.innerText = "close";
				closeLink.setAttribute("style",
					"display: block;"
					+ "position: absolute;"
					+ "right: 4px;"
					+ "top: 4px;"
				);
				div.appendChild(closeLink);

				document.body.appendChild(div);

				return canvas;
			}

			function clear() {
				removeElement(elementId);
			}

			function removeElement(elementId) {
				let element = document.getElementById(elementId);
				if (element) {
					element.remove();
				}
			}

			return {
				create: create,
				clear: clear
			}
		}();
		var kanbanCFD = function (Chart, kanbanDataHandler, modalCanvas) {
			let defaultTimeOfDailyInMs = 3600 * 9 * 1000;

			function createStructureCopy(input) {
				return JSON.parse(JSON.stringify(input));
			}

			function getCFDData(data, options, timeOfDailyInS) {
				let timeOfDaily = new Date(timeOfDailyInS ? timeOfDailyInS * 1000 : defaultTimeOfDailyInMs);

				let minDateTimestamp = kanbanDataHandler.getMinDate(data);
				let maxDateTimestamp = kanbanDataHandler.getMaxDate(data);

				let startDate = new Date(minDateTimestamp);
				startDate.setHours(timeOfDaily.getHours());
				startDate.setMinutes(timeOfDaily.getMinutes());
				startDate.setSeconds(0);
				startDate.setMilliseconds(0);

				let emptyMapDateToNumberOfCards = {};
				let walkDayTimestamp = startDate.getTime();
				let millisecondsOfADay = 3600 * 24 * 1000;
				while (walkDayTimestamp <= maxDateTimestamp) {
					emptyMapDateToNumberOfCards[walkDayTimestamp] = 0;
					walkDayTimestamp += millisecondsOfADay;
				}
				emptyMapDateToNumberOfCards[walkDayTimestamp] = 0;

				let lastDatetimeStamp = walkDayTimestamp;

				// one map for each status
				// each status entry maps date to no of cards at the point of the daily
				let result = {};
				options.forEach(function (entry) {
					result[entry[0]] = createStructureCopy(emptyMapDateToNumberOfCards);
				});

				// todo: "heavy" refactoring necessary...
				data.forEach(function (entry) {
					let walkDate = lastDatetimeStamp;
					let currentState = 0;

					while (entry[discardedColumn] && entry[discardedColumn] <= walkDate) {
						walkDate -= millisecondsOfADay;
					}

					while (currentState < options.length) {
						while (entry[options[currentState][1]] && (walkDate >= entry[options[currentState][1]])) {
							result[options[currentState][0]][walkDate]++;
							walkDate -= millisecondsOfADay;
						}
						currentState++;
					}
				});

				return result;
			}

			function getCfdDataEntry(state, data, color) {
				return {
					'label': state,
					'borderColor': color,
					'backgroundColor': color,
					'data': Object.values(data)
				}
			}

			function getChartOptions() {
				return {
					title: {
						display: true,
						text: 'Kanban Cumulative Flow Diagram'
					},
					maintainAspectRatio: false,
					elements: {
						line: {
							tension: 0,
						}
					},
					scales: {
						yAxes: [{
							stacked: true,
							scaleLabel: {
								display: true,
								labelString: '# Cards'
							}
						}],
						xAxes: [{
							scaleLabel: {
								display: true,
								labelString: 'Date'
							}
						}]
					}
				};
			}

			function computeChartData(data, dataOptions) {
				return {
					labels: Object.keys(data[dataOptions[0][0]]).map(function (k) {
						let date = new Date(Number.parseInt(k));
						return (date.getMonth() + 1) + "/" + date.getDate();
					}),
					datasets: dataOptions.map(optionArray => getCfdDataEntry(optionArray[0], data[optionArray[0]], optionArray[2]))
				};
			}

			function show(metrics, dataOptions, timeOfDailyInS) {
				let timestampData = kanbanDataHandler.transformToDateTime(metrics);
				let cfdData = getCFDData(timestampData, dataOptions, timeOfDailyInS)

				let canvas = modalCanvas.create();

				return new Chart(
					canvas, {
					type: 'line',
					data: computeChartData(cfdData, dataOptions),
					options: getChartOptions()
				}
				);
			}

			return {
				show: show,
				getCFDData: getCFDData
			}
		}(Chart, kanbanDataHandler, modalCanvas);

		if (typeof (module) !== 'undefined') {
			module.exports = kanbanCFD;
		}
		// const { getLTDData } = require("./kanbanDataHandler");

		var kanbanLTD = function (Chart, kanbanDataHandler, modalCanvas) {

			let workTypes = Object.keys(typeToColor);

			function computeLTDData(data, partition) {
				let result = {};

				data.forEach(entry => {
					if (entry[colDone] && entry[colStart]) {
						let durationInHours = (entry[colDone] - entry[colStart]) / 3600000;

						let fitsIn = 0;
						while (partition[fitsIn] && partition[fitsIn][0] < durationInHours) {
							fitsIn++;
						}

						if (!result[entry[colLabel]]) {
							result[entry[colLabel]] = [];
							for (let i = 0; i <= partition.length; i++) {
								result[entry[colLabel]][i] = 0;
							}
						}

						result[entry[colLabel]][fitsIn]++;
					}
				});

				return result;
			}

			function getChartOptions() {
				return {
					title: {
						display: true,
						text: 'Kanban Lead Time Distribution Diagram'
					},
					maintainAspectRatio: false,
					scales: {
						yAxes: [{
							stacked: true
						}],
						xAxes: [{
							stacked: true
						}]
					}
				};
			}

			function getChartDisplayData(data, partition) {
				return {
					labels: partition.map(e => e[1]),
					datasets: workTypes.map(type => getLTDDataSet(type, data)),
				};

			}

			function show(metrics, partition) {

				let timestampData = kanbanDataHandler.transformToDateTime(metrics);

				let ltdData = computeLTDData(timestampData, partition);

				let canvas = modalCanvas.create();
				let myChart = new Chart(
					canvas, {
					type: 'bar',
					data: getChartDisplayData(ltdData, partition),
					options: getChartOptions()
				}
				);
			}

			function getLTDDataSet(type, data) {
				return {
					label: type,
					backgroundColor: typeToColor[type],
					borderColor: "black",
					data: data[type],
				}
			}

			return {
				show: show
			};
		}(Chart, kanbanDataHandler, modalCanvas);

		if (typeof (module) !== 'undefined') {
			module.exports = kanbanLTD;
		}
		var kanbanRunChart = function (Chart, kanbanDataHandler, modalCanvas) {

			let workTypes = Object.keys(typeToColor);


			/**
			 * Input: metrics data
			 * Output: array with tuples ( date of done, timespan(h) in work, type) sorted asc by date of done
			 *
			 * @param {array of objects} timestampData
			 */
			function getRunChartData(timestampData) {
				let result = timestampData
					.filter(element => element[colDone] && element[colStart])
					.sort(function (a, b) {
						return a[colDone] - b[colDone];
					})
					.map(element => {
						let done = new Date(element[colDone]);
						return [done.getDate() + ". " + (done.getMonth() + 1) + ".", (element[colDone] - element[colStart]) / 3600000, element[colLabel]];
					});

				return result;
			}

			function getRunChartColumnLabels(data) {
				let currentDay = null;

				let result = [];
				for (let i = 0; i < data.length; i++) {
					if (data[i][0] != currentDay) {
						currentDay = data[i][0];
						result.push(currentDay);
					} else {
						result.push("");
					}
				}
				return result;
			}

			function getTypeRunChartData(type, data) {
				return data.map(element => element[2] == type ? element[1] : null);
			}

			function getRunChartDataset(type, data) {
				return {
					label: type,
					data: getTypeRunChartData(type, data),
					backgroundColor: typeToColor[type],
					borderColor: "black",
					borderWidth: 1,
					showLine: false,
					pointRadius: 8,
					pointHoverRadius: 15,
					pointStyle: 'circle'
				};
			}


			function getChartOptions() {
				return {
					title: {
						display: true,
						text: 'Kanban Run Chart'
					},
					maintainAspectRatio: false,
				};
			}

			function getRunChartDisplayData(data) {
				return {
					labels: getRunChartColumnLabels(data),
					datasets: workTypes.map(type => getRunChartDataset(type, data))
				};
			}

			function show(metrics) {
				let timeStampData = kanbanDataHandler.transformToDateTime(metrics);

				let runChartData = getRunChartData(timeStampData);

				let canvas = modalCanvas.create();
				return new Chart(canvas, {
					type: 'line',
					data: getRunChartDisplayData(runChartData),
					options: getChartOptions()
				});
			}

			return {
				show: show
			};
		}(Chart, kanbanDataHandler, modalCanvas);

		if (typeof (module) !== 'undefined') {
			module.exports = kanbanRunChart;
		}
		var conceptBoardIntegration = function (kanbanLTD, kanbanCFD, kanbanRunChart) {

			function getMetrics() {
				let extracted = [];
				document.querySelectorAll("div.text-area span.pointer-events")
					.forEach(element => {
						if (element.innerText.startsWith(metrics_prefix + ":")) {
							let typeStringSplitted = element.innerText.split(":", 2);
							let extractedData = {
								[colLabel]: typeStringSplitted[1].trim().toLowerCase()
							};
							
							let sibling = element;
							while (sibling = sibling.nextSibling) {
								if (sibling.nodeName == "SPAN") {									
									let indexFirstColon = sibling.innerHTML.indexOf(":");
									let fieldName = sibling.innerHTML.substr(0, indexFirstColon).trim();
									let fieldValue = sibling.innerHTML.substr(indexFirstColon + 2)
										.replaceAll(/( |&nbsp;)+/g, ' ')
										.trim();

									if (fieldName.length > 1) {
										extractedData[fieldName]
											= fieldValue
									}
								}
							}

							extracted.push(extractedData);
						}
					});
				return extracted;
			}

			function getMetricsAsCSV(data) {
				let separator = ";";
				let escape = '"';
				let newLine = "\n";

				let columnHash = {};
				data.forEach(function (element) {
					Object.keys(element).forEach(function (key) {
						columnHash[key] = 1;
					})
				});

				let columns = Object.keys(columnHash);

				let result = "";
				columns.forEach(function (key) {
					result += key + separator;
				});
				result += newLine;

				data.forEach(function (element) {
					columns.forEach(function (key) {
						result += escape + element[key] + escape + separator;
					});
					result += newLine;
				});

				return result;
			}

			function clearIcons() {
				document.querySelectorAll(".secondary-toolbar .igusChartIcon").forEach(element => element.remove());
			}

			function addRunChartIcon() {
				let iconBar = document.querySelectorAll(".secondary-toolbar.middle");

				let icon = document.createElement("button");
				icon.setAttribute("class", "tb-b-write button-container tb-button padded igusChartIcon");
				icon.innerHTML =
					'<i class="fonticon-business" style="color: #f07d00;" title="Zeige Run Chart" onclick="conceptBoardIntegration.showRunChart();"></i>';

				iconBar[0].appendChild(icon);
			}

			function addLTDIcon() {
				let iconBar = document.querySelectorAll(".secondary-toolbar.middle");

				let icon = document.createElement("button");
				icon.setAttribute("class", "tb-b-write button-container tb-button padded igusChartIcon");
				icon.innerHTML =
					'<i class="fonticon-business" style="color: #f07d00;" title="Zeige LTD" onclick="conceptBoardIntegration.showLTD();"></i>';

				iconBar[0].appendChild(icon);
			}

			function addCFDIcon() {
				let iconBar = document.querySelectorAll(".secondary-toolbar.middle");

				let icon = document.createElement("button");
				icon.setAttribute("class", "tb-b-write button-container tb-button padded igusChartIcon");
				icon.innerHTML =
					'<i class="fonticon-business"'
					+ ' style="color: #f07d00;"'
					+ ' title="Zeige CFD"'
					+ ' onclick="conceptBoardIntegration.showCFD();"></i>';

				iconBar[0].appendChild(icon);
			}

			function showRunChart() {
				kanbanRunChart.show(getMetrics());
			}

			function showLTD() {
				kanbanLTD.show(getMetrics(), partition);
			}

			function showCFD() {
				kanbanCFD.show(getMetrics(), cfdOptions);
			}




			function initialize() {
				console.log("initialize...");
				if (document.querySelectorAll(".secondary-toolbar.middle").length > 0) {
					clearIcons();
					addRunChartIcon();
					addLTDIcon();
					addCFDIcon();
					console.log("done");
				} else {
					//console.log ( document );
					//console.log ( document.querySelectorAll(".secondary-toolbar.middle") );
					//console.log ( $(".secondary-toolbar.middle"));
					setTimeout(initialize, 1000);
				}
			}


			initialize();


			return {
				initialize: initialize,
				getMetrics: getMetrics,
				showCFD: showCFD,
				showLTD, showLTD,
				showRunChart: showRunChart
			};

		}(kanbanLTD, kanbanCFD, kanbanRunChart);

		window.kanbanDataHander = kanbanDataHandler;
		window.conceptBoardIntegration = conceptBoardIntegration;
		window.modalCanvas = modalCanvas;
		window.kanbanCFD = kanbanCFD;
		window.kanbanLTD = kanbanLTD;
		window.kanbanrunChart = kanbanRunChart;

	});


})();


setTimeout(logSomething, 10000);

function logSomething() {
	console.log("start");
	console.log(document);
	console.log(document.querySelectorAll(".secondary-toolbar"));
}
