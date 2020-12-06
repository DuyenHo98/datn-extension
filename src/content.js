var browser = browser || chrome;

var GDocsClassName = {
	paragraph: "kix-paragraphrenderer",
	wordNode: "kix-wordhtmlgenerator-word-node",
};

class GDocsUtil {
	constructor() {}

	classNames = {
		paragraph: ".kix-paragraphrenderer",
		line: ".kix-lineview",
		selectionOverlay: ".kix-selection-overlay",
		wordNode: ".kix-wordhtmlgenerator-word-node",
		cursor: ".kix-cursor",
		cursorName: ".kix-cursor-name",
		cursorCaret: ".kix-cursor-caret",
	};

	cleanDocumentText(text) {
		var cleanedText = text.replace(/[\u200B\u200C]/g, "");
		var nonBreakingSpaces = String.fromCharCode(160);
		var regex = new RegExp(nonBreakingSpaces, "g");
		cleanedText = cleanedText.replace(regex, " ");
		return cleanedText;
	}

	getValidCharactersRegex() {
		return "\\wæøåÆØÅéáÉÁöÖ";
	}

	isWordBoundary(character) {
		return character.match("[" + this.getValidCharactersRegex() + "]") == null;
	}

	// Finds all the text and the caret position in the google docs document.
	getGoogleDocument() {
		var caret, caretRect;
		var caretIndex = 0;
		var caretLineIndex = 0;
		var caretLine = 0;
		var text = [];
		var nodes = [];
		var lineCount = 0;
		var globalIndex = 0;
		var selectedText = "";
		var exportedSelectionRect = undefined;
		var paragraphrenderers = document.querySelectorAll(
			this.classNames.paragraph
		);

		if (this.containsUserCaretDom()) {
			caret = this.getUserCaretDom();
			caretRect = caret.getBoundingClientRect();
		}

		for (var i = 0; i < paragraphrenderers.length; i++) {
			var lineviews = paragraphrenderers[i].querySelectorAll(
				this.classNames.line
			);
			for (var j = 0; j < lineviews.length; j++) {
				var lineText = "";
				var selectionOverlays = lineviews[j].querySelectorAll(
					this.classNames.selectionOverlay
				);
				var wordhtmlgeneratorWordNodes = lineviews[j].querySelectorAll(
					this.classNames.wordNode
				);
				for (var k = 0; k < wordhtmlgeneratorWordNodes.length; k++) {
					var wordhtmlgeneratorWordNodeRect = wordhtmlgeneratorWordNodes[
						k
					].getBoundingClientRect();
					if (caretRect) {
						if (
							this.doesRectsOverlap(wordhtmlgeneratorWordNodeRect, caretRect)
						) {
							var caretXStart =
								caretRect.left - wordhtmlgeneratorWordNodeRect.left;
							console.log(
								caretRect.left,
								wordhtmlgeneratorWordNodeRect.left,
								caretXStart,
								wordhtmlgeneratorWordNodeRect,
								lineviews,
								" dsadsa"
							);
							var localCaretIndex = this.getLocalCaretIndex(
								caretXStart,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);

							caretIndex = globalIndex + localCaretIndex;
							caretLineIndex = lineText.length + localCaretIndex;
							caretLine = lineCount;
						}
					}
					var nodeText = this.cleanDocumentText(
						wordhtmlgeneratorWordNodes[k].textContent
					);
					nodes.push({
						index: globalIndex,
						line: lineCount,
						lineIndex: lineText.length,
						node: wordhtmlgeneratorWordNodes[k],
						lineElement: lineviews[j],
						text: nodeText,
					});

					for (var l = 0; l < selectionOverlays.length; l++) {
						var selectionOverlay = selectionOverlays[l];
						var selectionRect = selectionOverlay.getBoundingClientRect();

						if (selectionRect) exportedSelectionRect = selectionRect;

						if (
							this.doesRectsOverlap(
								wordhtmlgeneratorWordNodeRect,
								selectionOverlay.getBoundingClientRect()
							)
						) {
							var selectionStartIndex = this.getLocalCaretIndex(
								selectionRect.left - wordhtmlgeneratorWordNodeRect.left,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);
							var selectionEndIndex = this.getLocalCaretIndex(
								selectionRect.left +
									selectionRect.width -
									wordhtmlgeneratorWordNodeRect.left,
								wordhtmlgeneratorWordNodes[k],
								lineviews[j]
							);
							selectedText += nodeText.substring(
								selectionStartIndex,
								selectionEndIndex
							);
						}
					}

					globalIndex += nodeText.length;
					lineText += nodeText;
				}
				text.push(lineText);
				lineCount++;
			}
		}
		return {
			nodes: nodes,
			text: text,
			selectedText: selectedText,
			caret: {
				index: caretIndex,
				lineIndex: caretLineIndex,
				line: caretLine,
			},
			selectionRect: exportedSelectionRect,
		};
	}

	doesRangesOverlap(x1, x2, y1, y2) {
		return x1 <= y2 && y1 <= x2;
	}

	// http://stackoverflow.com/questions/306316/determine-if-two-rectangles-overlap-each-other
	doesRectsOverlap(RectA, RectB) {
		return (
			RectA.left <= RectB.right &&
			RectA.right >= RectB.left &&
			RectA.top <= RectB.bottom &&
			RectA.bottom >= RectB.top
		);
	}

	// The kix-cursor contain a kix-cursor-name dom, which is only set when it is not the users cursor
	containsUserCaretDom() {
		var carets = document.querySelectorAll(this.classNames.cursor);
		for (var i = 0; i < carets.length; i++) {
			var nameDom = carets[i].querySelectorAll(this.classNames.cursorName);
			var name = nameDom[0].innerText;
			if (!name) return true;
		}
		return false;
	}

	// The kix-cursor contain a kix-cursor-name dom, which is only set when it is not the users cursor
	getUserCaretDom() {
		var carets = document.querySelectorAll(this.classNames.cursor);
		for (var i = 0; i < carets.length; i++) {
			var nameDom = carets[i].querySelectorAll(this.classNames.cursorName);
			var name = nameDom[0].innerText;
			if (!name)
				return carets[i].querySelectorAll(this.classNames.cursorCaret)[0];
		}

		throw "Could not find the users cursor";
	}

	// Gets the caret index on the innerText of the element.
	// caretX: The x coordinate on where the element the caret is located
	// element: The element on which contains the text where in the caret position is
	// simulatedElement: Doing the calculation of the caret position, we need to create a temporary DOM, the DOM will be created as a child to the simulatedElement.
	getLocalCaretIndex(caretX, element, simulateElement) {
		//Creates a span DOM for each letter
		var text = this.cleanDocumentText(element.innerText);
		var container = document.createElement("div");
		var letterSpans = [];
		for (var i = 0; i < text.length; i++) {
			var textNode = document.createElement("span");
			textNode.innerText = text[i];
			textNode.style.cssText = element.style.cssText;
			// "pre" = if there are multiple white spaces, they will all be rendered. Default behavior is for them to be collapesed
			textNode.style.whiteSpace = "pre";
			letterSpans.push(textNode);
			container.appendChild(textNode);
		}
		container.style.whiteSpace = "nowrap";
		simulateElement.appendChild(container);

		// The caret is usually at the edge of the letter, we find the edge we are closest to.
		var index = 0;
		var currentMinimumDistance = -1;
		var containerRect = container.getBoundingClientRect();
		for (var i = 0; i < letterSpans.length; i++) {
			var rect = letterSpans[i].getBoundingClientRect();
			var left = rect.left - containerRect.left;
			var right = left + rect.width;
			if (currentMinimumDistance == -1) {
				currentMinimumDistance = Math.abs(caretX - left);
			}
			var leftDistance = Math.abs(caretX - left);
			var rightDistance = Math.abs(caretX - right);

			if (leftDistance <= currentMinimumDistance) {
				index = i;
				currentMinimumDistance = leftDistance;
			}

			if (rightDistance <= currentMinimumDistance) {
				index = i + 1;
				currentMinimumDistance = rightDistance;
			}
		}

		//Clean up
		container.remove();
		return index;
	}

	//- - - - - - - - - - - - - - - - - - - -
	//Google Document utils
	//- - - - - - - - - - - - - - - - - - - -
	findWordAtCaret(googleDocument) {
		var line = googleDocument.text[googleDocument.caret.line];
		if (!line) return;
		if (line.length == 0)
			return {
				word: "",
				startIndex: googleDocument.caret.index,
				endIndex: googleDocument.caret.index,
			};

		var startIndex = googleDocument.caret.lineIndex;
		var endIndex = googleDocument.caret.lineIndex;

		//We are at the end of the line
		if (googleDocument.caret.lineIndex >= line.length) {
			startIndex = line.length - 1;
			endIndex = line.length - 1;
		}

		//Finds the start of the word
		var character = line[startIndex];
		//If we are at the end of the word, the startIndex will result in a word boundary character.
		if (this.isWordBoundary(character) && startIndex > 0) {
			startIndex--;
			character = line[startIndex];
		}
		while (!this.isWordBoundary(character) && startIndex > 0) {
			startIndex--;
			character = line[startIndex];
		}

		//Finds the end of the word
		character = line[endIndex];
		while (!this.isWordBoundary(character) && endIndex < line.length - 1) {
			endIndex++;
			character = line[endIndex];
		}

		var globalStartIndex =
			googleDocument.caret.index - googleDocument.caret.lineIndex + startIndex;
		var globalEndIndex =
			googleDocument.caret.index - googleDocument.caret.lineIndex + endIndex;
		return {
			word: line.substring(startIndex, endIndex).trim(),
			startIndex: globalStartIndex,
			endIndex: globalEndIndex,
		};
		//return line.substring(startIndex, endIndex).trim();
	}

	//- - - - - - - - - - - - - - - - - - - -
	//Highlight
	//- - - - - - - - - - - - - - - - - - - -
	highlight(
		startIndex,
		endIndex,
		googleDocument,
		rawWord,
		newWord,
		start,
		nodeElement
	) {
		for (var i = 0; i < googleDocument.nodes.length; i++) {
			//Highlight node if its index overlap with the provided index
			if (
				this.doesRangesOverlap(
					startIndex,
					endIndex,
					googleDocument.nodes[i].index,
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				)
			) {
				//Only draw highlight if there is text to highlight
				var textToHighlight = this.getTextInNode(
					startIndex,
					endIndex,
					googleDocument.nodes[i]
				);
				if (!textToHighlight.trim()) continue;

				var parentRect = googleDocument.nodes[
					i
				].lineElement.getBoundingClientRect();
				var nodeRect = googleDocument.nodes[i].node.getBoundingClientRect();
				var leftPosOffset = 0;
				var rightPosOffset = nodeRect.width;
				if (startIndex > googleDocument.nodes[i].index) {
					var localIndex = startIndex - googleDocument.nodes[i].index;
					leftPosOffset = this.getPositionOfIndex(
						localIndex,
						googleDocument.nodes[i].node,
						googleDocument.nodes[i].lineElement
					);
				}

				if (
					endIndex <
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				) {
					rightPosOffset = this.getPositionOfIndex(
						endIndex - googleDocument.nodes[i].index,
						googleDocument.nodes[i].node,
						googleDocument.nodes[i].lineElement
					);
				}

				console.log(nodeRect.left, parentRect.left, leftPosOffset, "hihi");
				this.createHighlightNode(
					nodeRect.left - parentRect.left + leftPosOffset,
					nodeRect.top - parentRect.top,
					rightPosOffset - leftPosOffset,
					nodeRect.height,
					googleDocument.nodes[i].lineElement,
					googleDocument.nodes[i].index,
					rawWord,
					newWord,
					start,
					nodeElement
				);
			}
		}
	}

	getText(startIndex, endIndex, googleDocument) {
		var text = "";
		for (var i = 0; i < googleDocument.nodes.length; i++) {
			if (
				this.doesRangesOverlap(
					startIndex,
					endIndex,
					googleDocument.nodes[i].index,
					googleDocument.nodes[i].index + googleDocument.nodes[i].text.length
				)
			) {
				var textInNode = this.getTextInNode(
					startIndex,
					endIndex,
					googleDocument.nodes[i]
				);
				text += textInNode;
			}
		}

		return text;
	}

	getTextInNode(startIndex, endIndex, node) {
		var start = 0;
		var end = node.text.length;
		if (startIndex > node.index) {
			start = startIndex - node.index;
		}
		if (endIndex < node.index + node.text.length) {
			end = endIndex - node.index;
		}
		return node.text.substring(start, end);
	}

	createHighlightNode(
		left,
		top,
		width,
		height,
		parentElement,
		parentIndex,
		rawWord,
		newWord,
		start,
		nodeElement
	) {
		console.log("createHighlightNode ", rawWord, newWord, parentIndex, start);
		var highlightNode = document.createElement("div");
		highlightNode.setAttribute(
			"class",
			"dictus_highlight_node dictus_highlight_node_" +
				parentIndex +
				" dictus_highlight_node_line_" +
				rawWord
		);
		highlightNode.style.position = "absolute";
		highlightNode.style.left = left + "px";
		highlightNode.style.top = top + "px";
		highlightNode.style.width = width + "px";
		highlightNode.style.height = height + "px";
		highlightNode.style.borderBottomColor = "#FF0000";
		highlightNode.style.borderBottomStyle = "solid";
		highlightNode.style.borderBottomWidth = 2 + "px";
		highlightNode.style.opacity = 0.5;
		highlightNode.style.zIndex = 999;
		if (!this.suggestNode) {
			this.initSuggestNode(parentElement);
		}
		highlightNode.addEventListener("click", () => {
			console.log(
				"onClick ",
				newWord,
				parentIndex,
				start,
				nodeElement,
				parentElement
			);
			this.suggestNode.style.opacity = 1;
			this.suggestNode.style.left = left + "px";
			this.suggestNode.style.top = top - 35 + "px";
			this.suggestNode.getElementsByClassName(
				"dictus_suggest_word_node"
			)[0].innerHTML = newWord;
			this.suggestNode.rawWord = rawWord;
			this.suggestNode.start = start;
			this.suggestNode.nodeElement = nodeElement;
			this.suggestNode.newWord = newWord;
			this.suggestNode.highlightNode = highlightNode;
		});
		parentElement.appendChild(highlightNode);
	}

	initSuggestNode(parentElement) {
		this.suggestNode = document.createElement("div");
		this.suggestNode.style.opacity = 0;
		this.suggestNode.setAttribute("class", "dictus_suggest_node");
		this.suggestNode.style.position = "absolute";
		this.suggestNode.style.width = 50 + "px";
		this.suggestNode.style.height = 25 + "px";
		this.suggestNode.style.borderColor = "#bebebe";
		this.suggestNode.style.borderStyle = "solid";
		this.suggestNode.style.borderWidth = 1 + "px";
		this.suggestNode.style.zIndex = 999;
		this.suggestNode.style.textAlign = "center";
		this.suggestNode.style.backgroundColor = "#fff";
		this.suggestNode.style.borderRadius = "3px";
		this.suggestNode.addEventListener("click", () => console.log("clicked "));
		parentElement.appendChild(this.suggestNode);

		var correctWordNode = document.createElement("div");
		correctWordNode.setAttribute("class", "dictus_suggest_word_node");
		correctWordNode.style.position = "absolute";
		correctWordNode.style.width = 50 + "px";
		correctWordNode.style.height = 30 + "px";
		correctWordNode.style.zIndex = 999;
		correctWordNode.style.textAlign = "center";
		correctWordNode.style.paddingTop = 6 + "px";
		correctWordNode.addEventListener("click", () => {
			this.suggestNode.style.opacity = 0;
			// let text = this.suggestNode.nodeElement.node.innerText;
			// text =
			// 	text.substring(0, this.suggestNode.start) +
			// 	this.suggestNode.newWord +
			// 	text
			// 		.substring(
			// 			this.suggestNode.start + this.suggestNode.rawWord.length + 1
			// 		)
			// 		.trim();
			// this.suggestNode.nodeElement.node.innerText = text;

			let nodeElement = this.suggestNode.nodeElement;
			let caret = this.getUserCaretDom();
			let caretRect = caret.getBoundingClientRect();
			let wordRect = nodeElement.node.getBoundingClientRect();
			var caretXStart = caretRect.left - wordRect.left;
			var localCaretIndex = this.getLocalCaretIndex(
				caretXStart,
				nodeElement.node,
				nodeElement.lineElement
			);

			moveCursor(this.suggestNode.start - localCaretIndex);
			deleteChars(this.suggestNode.rawWord.length);
			pasteText(this.suggestNode.newWord);

			this.suggestNode.highlightNode.remove();
		});
		this.suggestNode.appendChild(correctWordNode);
		return this.suggestNode;
	}

	removeSuggestNodes() {
		var suggestNodes = document.querySelectorAll(".dictus_suggest_node");
		for (let i = 0; i < suggestNodes.length; i++) {
			suggestNodes[i].remove();
		}
		this.suggestNode = null;
	}

	removeAllHighlightNodes() {
		var highlightNodes = document.querySelectorAll(".dictus_highlight_node");
		for (let i = 0; i < highlightNodes.length; i++) {
			highlightNodes[i].remove();
		}
	}

	removeHighlightonNodes(nodeIndex) {
		var highlightNodes = document.querySelectorAll(
			".dictus_highlight_node_" + nodeIndex
		);

		for (let i = 0; i < highlightNodes.length; i++) {
			console.log("voday di", highlightNodes[i].className, "a");
			highlightNodes[i].remove();
		}
	}

	//Index: The index on the local element
	getPositionOfIndex(index, element, simulateElement) {
		//If index is 0 it is always the left most position of the element
		if (index == 0) {
			return 0;
		}

		//Creates a span DOM for each letter
		var text = this.cleanDocumentText(element.innerText);
		var container = document.createElement("div");
		var letterSpans = [];
		for (var i = 0; i < index; i++) {
			var textNode = document.createElement("span");
			textNode.innerText = text[i];
			textNode.style.cssText = element.style.cssText;
			//"pre" = if there are multiple white spaces, they will all be rendered. Default behavior is for them to be collapesed
			textNode.style.whiteSpace = "pre";
			letterSpans.push(textNode);
			container.appendChild(textNode);
		}
		simulateElement.appendChild(container);

		var containerRect = container.getBoundingClientRect();
		var rect = letterSpans[index - 1].getBoundingClientRect();
		var leftPosition = rect.left + rect.width - containerRect.left;

		//Clean up
		container.remove();
		return leftPosition;
	}

	findNodeInAllDocument(node, googleDocument) {
		var lineElement = node.getElementsByClassName("kix-lineview")[0];
		for (let i = 0; i < googleDocument.nodes.length; i++) {
			if (googleDocument.nodes[i].lineElement == lineElement) {
				return googleDocument.nodes[i];
			}
		}
		return null;
	}

	convertLocalPosToGlobleNode(text, parentNode, start) {
		var lineElementText = preValidate(parentNode.lineElement.innerText);
		// var lineElementText = parentNode.lineElement.innerText;
		var startLocalPos = lineElementText.indexOf(text, start);
		var startGloblePos = startLocalPos + parentNode.index;
		var endGloblePos = startGloblePos + text.length;
		console.log(
			"line ele",
			text,
			start,
			startLocalPos,
			startGloblePos,
			endGloblePos
		);

		return {
			startIndex: startGloblePos,
			endIndex: endGloblePos,
		};
	}
}

function getInputsByValue() {
	var allInputs = document.getElementsByTagName("input");
	var results = [];
	for (var x = 0; x < allInputs.length; x++) results.push(allInputs[x]);

	var allTextArea = document.getElementsByTagName("textarea");
	for (var x = 0; x < allTextArea.length; x++) results.push(allTextArea[x]);

	return results;
}

function getValidInput(allInputs) {
	var results = [];
	for (var i in allInputs) {
		if (allInputs[i].type == "text" || allInputs[i].type == "textarea") {
			console.log(
				"=== getValidInput in ",
				allInputs[i],
				allInputs[i] instanceof Array
			);
			if (allInputs[i] instanceof Array) {
				results.push(allInputs[i][0]);
			} else {
				results.push(allInputs[i]);
			}
		}
	}
	console.log("getValidInput ", JSON.stringify(results));
	return results;
}

function getValidInputForGDocs() {
	var allParagraph = document.getElementsByClassName(GDocsClassName.wordNode);
	var results = [];
	for (var i in allParagraph) {
		if (
			allParagraph[i] &&
			allParagraph[i].innerText &&
			allParagraph[i].innerText.length > 0
		) {
			allParagraph[i].value = allParagraph[i].innerText;
			allParagraph[i].type = "text";
			results.push(allParagraph[i]);
		}
	}
	console.log("== getValidInputForGDocs: ", JSON.stringify(results));
	return results;
}

// function init() {

// 	// var allInputs = getInputsByValue();
// 	var allInputs = getValidInputForGDocs();
// 	if (allInputs.length == 0) {
// 		console.log('=== found 0 input');
// 	} else {

// 		const content = document.getElementsByClassName('kix-wordhtmlgenerator-word-node')[0]
// 		console.log('=== ahih content ', content);
// 		content.addEventListener('DOMSubtreeModified', () => console.log('change'))

// 		var validInput = getValidInput(allInputs);
// 		console.log('== ahihi loop1 ', validInput);
// 		validInput.forEach(function (el) {
// 			console.log('=== el ', el);
// 			el.addEventListener('DOMSubtreeModified', (e) => {
// 				console.log('in: ', el, " | ", el.value)
// 				if (el.value.length > 10) {
// 					if (!el.isSetTimeout) {
// 						console.log('== voday');
// 						el.isSetTimeout = true;
// 						el.timeout = setTimeout(function () {
// 							browser.runtime.sendMessage({
// 								message: el.value
// 							}, function (response) {
// 								console.log("response: ", response);
// 								appendNodeCorrect(el, response.message, el.value)
// 								el.isSetTimeout = false;
// 							});
// 						}, 1000)
// 					}
// 				}
// 			})
// 		})
// 	}
// }

function init() {
	var allInputs = getValidInputForGDocs();
	if (allInputs.length == 0) {
		console.log("=== found 0 input");
	} else {
		var gDoc = new GDocsUtil();
		var allDocument = gDoc.getGoogleDocument();
		var allParagraph = document.getElementsByClassName(
			"kix-paginateddocumentplugin"
		)[0];
		allParagraph.addEventListener("DOMSubtreeModified", () => {
			if (gDoc.containsUserCaretDom()) {
				caret = gDoc.getUserCaretDom();
				caretRect = caret.getBoundingClientRect();
				if (!allParagraph.isTimeOut) {
					allParagraph.isTimeOut = true;
					var allSpan = allParagraph.querySelectorAll(
						gDoc.classNames.paragraph
					);
					for (let i = 0; i < allSpan.length; i++) {
						if (
							allSpan[i] &&
							gDoc.doesRectsOverlap(
								allSpan[i].getBoundingClientRect(),
								caretRect
							)
						) {
							this.idTimeOutGetText && clearTimeout(this.idTimeOutGetText);
							this.idTimeOutGetText = setTimeout(() => {
								let paragraph = allSpan[i];
								let lines = paragraph.getElementsByClassName(
									"kix-wordhtmlgenerator-word-node"
								);
								let text = "";
								for (let i = 0; i < lines.length; i++) {
									text += lines[i].innerText;
								}
								text = preValidate(text);
								if (this.beforeText && this.beforeText === text) {
									allParagraph.isTimeOut = false;
									return;
								}
								this.beforeText = text;
								console.log("hihi haha", "|" + text + "|");
								browser.runtime.sendMessage(
									{
										message: text,
									},
									function (response) {
										console.log(
											"response: ",
											response.in,
											"||||||",
											response.out
										);
										allDocument = gDoc.getGoogleDocument();
										// var gNode = gDoc.findNodeInAllDocument(allSpan[i], allDocument);
										// if (gNode) {
										// 	processAppendNodeCorrect(response.in, response.out, text, gNode, gDoc, allDocument);
										// }

										processAppendNodeCorrect(
											response.in,
											response.out,
											text,
											gDoc,
											allDocument,
											lines
										);

										allParagraph.isTimeOut = false;
									}
								);
							}, 2000);
						}
					}
				}
			}
		});
	}
}

function findNodeIndexInDoc(lineElement, googleDocument) {
	for (let i = 0; i < googleDocument.nodes.length; i++) {
		if (googleDocument.nodes[i].node == lineElement) {
			return i;
		}
	}
	return -1;
}

function processAppendNodeCorrect(
	rawMsg,
	newMsg,
	rawMsg1,
	gDoc,
	allDocument,
	lines
) {
	gDoc.removeSuggestNodes();
	var newSplited = preValidateSpecialChar(newMsg).split(" ");
	let j = 0;
	let nodeId = -1;
	for (let l = 0; l < lines.length; l++) {
		if (nodeId < 0) nodeId = findNodeIndexInDoc(lines[l], allDocument); //todo: check no id found
		if (nodeId < 0) continue;

		let node = allDocument.nodes[nodeId];
		gDoc.removeHighlightonNodes(node.index);

		let line = lines[l].innerText;

		var rawSplited = preValidateSpecialChar(line).split(" ");
		// var rawSplited = line.split(" ");
		// console.log("split ",rawSplited)
		var cur = 0;
		var vCur = 0;
		for (var i = 0; i < rawSplited.length; i++) {
			// let text = preValidate(rawSplited[i]);
			let text = rawSplited[i];
			if (newSplited[j] && newSplited[j].length > 0 && newSplited[j] != text) {
				var pos = gDoc.convertLocalPosToGlobleNode(text, node, vCur);
				gDoc.highlight(
					pos.startIndex,
					pos.endIndex,
					gDoc.getGoogleDocument(),
					text,
					newSplited[j],
					cur,
					node
				);
			}
			cur += rawSplited[i].length + 1;
			if (text.length > 0) {
				vCur = text.length + 1;
			}

			j++;
		}
		nodeId++;
	}
	// var rawSplited = preValidateSpecialChar(rawMsg).split(' ');
	// var cur = 0;
	// for (var i = 0; i < newSplited.length; i++) {
	// 	if (newSplited[i] && newSplited[i].length > 0 && newSplited[i] != rawSplited[i]) {
	// 		var pos = gDoc.convertLocalPosToGlobleNode(rawSplited[i], node, cur);
	// 		gDoc.highlight(pos.startIndex, pos.endIndex, gDoc.getGoogleDocument(), rawSplited[i], newSplited[i], cur, node);

	// 		cur+=newSplited[i].length + 1;
	// 	}
	// }
}

function preValidate(sentence) {
	return sentence.replaceAll("\u200c", "");
}

function preValidateSpecialChar(sentence) {
	var validCheckArr = "!\"',-.:;?_()";
	for (var i in validCheckArr) {
		sentence = sentence.replaceAll(validCheckArr[i], "");
	}
	return sentence.replace(/ +(?= )/g, "").replaceAll("\u200c", "");
}

document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		setTimeout(function () {
			init();

			// pasteText("Dsadsada");
			// pressButton();
		}, 500);
	}
};

function pasteText(text) {
	var el = document.getElementsByClassName("docs-texteventtarget-iframe")[0];
	el = el.contentDocument.querySelector("[contenteditable=true]");

	var data = new DataTransfer();
	data.setData("text/plain", text);
	var paste = new ClipboardEvent("paste", {
		clipboardData: data,
		data: text,
		dataType: "text/plain",
	});
	paste.docs_plus_ = true;

	el.dispatchEvent(paste);
}

// function pressButton() {
// 	var el = document.getElementsByClassName("docs-texteventtarget-iframe")[0];
// 	el = el.contentDocument.querySelector("[contenteditable=true]");

// 	let obj = { bubbles: true, screenX: 312, screenY: 122 };
//     el.dispatchEvent(new MouseEvent("mouseenter", obj));
//     el.dispatchEvent(new MouseEvent("mousedown", obj));
//     el.dispatchEvent(new MouseEvent("mouseup", obj));
//     el.dispatchEvent(new MouseEvent("click", obj));
//     el.dispatchEvent(new MouseEvent("mouseleave", obj));
// };

function moveCursor(amount) {
	pressKey(amount > 0 ? 39 : 37, Math.abs(amount));
}

function deleteChars(amount) {
	pressKey(46, Math.abs(amount));
}

function pressKey(keyCode, times) {
	var el = document.getElementsByClassName("docs-texteventtarget-iframe")[0];
	el = el.contentDocument;

	var data = {
		keyCode: keyCode,
		ctrlKey: false,
		shiftKey: false,
	};
	var key_event;

	key_event = new KeyboardEvent("keydown", data);
	key_event.docs_plus_ = true;

	for (let i = 0; i < times; i++) {
		el.dispatchEvent(key_event);
	}
}
