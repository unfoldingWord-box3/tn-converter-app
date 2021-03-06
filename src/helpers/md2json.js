const marked = require('marked');
const traverse = require('traverse');

const parse = function(mdContent) {
  let aligned = getAlignedContent(mdContent);
  let json = marked.lexer(aligned);
  let currentHeading,
      headings = [],
      isOrdered = true,
      orderedDepth = 1,
      headingOrder = 1;
  const result = {};

  for (let i = 0; i < json.length; i++) {
    const item = json[i];

    switch (item.type) {
      case 'heading':
        if (!currentHeading || item.depth === 1) {
          headings = [];
          result[headingOrder] = {};
          currentHeading = result[headingOrder];
          headings.push(item.text);
          currentHeading.occurrence = headingOrder;
          currentHeading.heading = item.text;
          ++headingOrder;
        } else {
          var parentHeading = getParentHeading(headings, item, result);
          headings = parentHeading.headings;
          currentHeading = parentHeading.parent;
          currentHeading[headingOrder] = {};
          currentHeading = currentHeading[headingOrder];
          currentHeading.occurrence = headingOrder;
          ++headingOrder;
        }
        break;
      case 'list_start':
        isOrdered = item.ordered;
        orderedDepth = item.start;
        break;
      case 'list_end':
        if (currentHeading.raw) {
            currentHeading.raw = checkNextLine(currentHeading.raw);
        }
        break;
      case 'text':
        if (isOrdered) {
          var ordered = orderedDepth + ". ";
          orderedDepth++;
        }
        else {
          ordered = '- ';
        }
        var text = ordered + item.text + '\n';
        currentHeading.raw = currentHeading.raw ? currentHeading.raw + text : text;
        break;
      case 'html':
        if (!currentHeading) {
            currentHeading = result;
        }
        var para = checkNextLine(item.text);
        currentHeading.raw = currentHeading.raw ? currentHeading.raw + para : para;
        break;
      case 'table':
        var tableContent = getTableContent(item);
        currentHeading.raw = currentHeading.raw ? currentHeading.raw + tableContent : tableContent;
        break;
      case 'code':
        var codeContent = getCodeContent(item);
        currentHeading.raw = currentHeading.raw ? currentHeading.raw + codeContent : codeContent;
        break;
      case 'space':
        if (currentHeading) {
          currentHeading.raw = currentHeading.raw ? currentHeading.raw + '\n' : '\n';
        }
        break;
      case 'paragraph':
        if (!currentHeading) {
          currentHeading = result;
        }
        para = checkNextLine(item.text);
        currentHeading.raw = currentHeading.raw ? currentHeading.raw + para : para;
        break;
      default:
        break;
    }
  }

  return result;
}
exports.parse = parse;

function getAlignedContent(mdContent) {
    var headings = mdContent.match(/(?:\r\n)#.*$/mg);
    if(!headings) {
        return mdContent;
    }
    for (var i = 0; i < headings.length; i++) {
        var heading = headings[i].trim();
        var propHeading = new RegExp('(?:\r\n){2}' + heading + '.*$', 'mg');
        if(!mdContent.match(propHeading)) {
            var wrongHeading = new RegExp('(?:\r\n)' + heading + '.*$', 'mg');
            mdContent = mdContent.replace(wrongHeading, '\r\n\r\n' + heading);
        }
    }
    return mdContent;
}

function getParentHeading(headings, item, result) {
  var parent, index = item.depth - 1;
  var currentHeading = headings[index];

  if (currentHeading) {
    headings.splice(index, headings.length - index);
  }

  headings.push(item.text);

  for (var i = 0; i < index; i++) {
    const keyHeading = headings[i];

    if (!parent) {
      let found = undefined;
      for (var j = 0; j < Object.keys(result).length; j++) {
        const key = Object.keys(result)[j]
        const value = result[key];
        if (value.heading === keyHeading) {
          found = value;
          break;
        }
      }

      parent = found;
    } else {
      parent = parent[keyHeading];
    }
  }

  return {
    headings: headings,
    parent: parent
  };
}

function getTableContent(item) {
    var tableHeader = '',
        tableContent = '',
        separator = '';
    for (let i = 0; i < item.header.length; i++) {
        tableHeader += item.header[i] + ' | ';
    }

    for (let j = 0; j < item.align.length; j++) {
        switch (item.align[j]) {
            case "right":
                separator += '--:|';
                break;
            case "left":
                separator += ':--|';
                break;
            case "center":
                separator += ':-:|';
                break;
            default:
                separator += '---|';
                break;
        }
    }

    for (var i = 0; i < item.cells.length; i++) {
        var cells = item.cells[i];
        for (var j = 0; j < cells.length; j++) {
            tableContent += cells[j] + ' | ';
        }
        var sep = i !== item.cells.length - 1 ? '| ' : '';
        tableContent += '\n' + sep;
    }
    return '| ' + tableHeader + '\n|' + separator + '\n| ' + tableContent + '\n';
}

function getCodeContent(item) {
  var open = "```";
  if (item.lang) {
    open = open + item.lang;
  }

  var content = item.text;
  var close = "```";
  return checkNextLine([open, content, close].join("\n"));
}

function checkNextLine(mdText) {
    if (mdText && !mdText.endsWith('\n\n')) {
        mdText += '\n\n';
    }
    return mdText;
}

function toMd(jsonObject) {
    var mdText = '';
    traverse(jsonObject).reduce(function(acc, value) {
        if (this.isLeaf && this.key === 'raw') {
          mdText += value;
        } else {
          mdText += getHash(this.level) + ' ' + this.key + '\n\n';
        }
        // eslint-disable-next-line
        return;
    });
    return mdText;
}
exports.toMd = toMd;

function getHash(level) {
    var hash = '';
    for (var i = 0; i < level; i++) {
        hash += '#';
    }
    return hash;
}
