let tag = null;
let pageContent = null;

function reset() {
    chrome.runtime.sendMessage({ op: "reset" });
    chrome.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => chrome.tabs.sendMessage(tab.id, {type: 'stop'}))
    setTimeout(() => setup(), 1000);
}

async function setup() {
    pageContent = document.querySelector('#page-content');
    const [currentTab] =
          await chrome.tabs.query({active: true, currentWindow: true});
    const url = new URL(currentTab.url);
    const pathParts = url.pathname.split('/');
    tag = decodeURIComponent(pathParts[2].replace('*s*', '/'));

    const data = await chrome.storage.local.get({ "archiving": false, "downloadDir": "archive" });
    if (data.archiving) {
        loadUpdatedValues();
        return;
    }

    pageContent.innerHTML =
        `
  <label for="directory">Download subdirectory:</label> <input id="directory" size=20 value=${data.downloadDir}>
  <p><select id="format">
    <option value="1">AZW3</option>
    <option value="2" selected>EPUB</option>
    <option value="3">MOBI</option>
    <option value="4">PDF</option>
    <option value="5">HTML</option>
  </select>
  <p><button id="archive">Archive</button>
  <p><button id="reset">Reset</button>
`

    const button = document.querySelector("#archive");
    button.textContent = `Archive ${tag}`;
    button.onclick = doArchive;

    const resetButton = document.querySelector("#reset");
    resetButton.onclick = reset;
}

function loadUpdatedValues() {
    chrome.storage.local.get({
        "currentPage": 0,
        "works": [],
        "downloadUrls": [],
        "downloadIndex": 0,
        "pages": null,
        "archiving": false,
        "throttledUntil": null,
    }).then(({ currentPage, works, downloadUrls, downloadIndex, pages, archiving, throttledUntil }) => {
        if (!archiving) {
            return;
        }
        updateContent(currentPage, works, downloadUrls, downloadIndex, pages, throttledUntil);
    })
}

chrome.runtime.onMessage.addListener(message => {
    switch (message.op) {
    case 'throttled':
        const date = new Date();
        const futureMilliseconds = date.getMilliseconds() + message.throttledFor;
        chrome.storage.local.set({ "throttledUntil": futureMilliseconds });
        break;
    default:
        break;
    }
    return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
    loadUpdatedValues();
});

(async () => setup())();

function updateContent(currentPage, works, downloadUrls, downloadIndex, pages, throttledUntil) {
    if (currentPage == pages &&
        downloadUrls.length == works.length &&
        downloadIndex == downloadUrls.length)
    {
        pageContent.innerHTML = `
<p>Archiving complete.
<p><button id="Reset">Reset</button>
`;
        document.querySelector("#reset").onclick = reset;
        return;
    }
    let content = `
<h5>Archiving <u>${tag}</u>...</h5>
<p>Scanned ${currentPage}/${pages != null ? pages : "??"} pages for works.
<p>Retrieved ${downloadUrls.length}/${works.length} download links.
<p>Started ${downloadIndex}/${downloadUrls.length} downloads.
`
    if (throttledUntil) {
        const now = new Date();
        const date = new Date();
        date.setMilliseconds(throttledUntil);
        if (now < date) {
            const dateString = date.toLocaleString('en-US', {
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            });
            content += `<p>Rate-limited by AO3 until ${dateString}.`
        }
    }

    content +=
`
<div class="lds-dual-ring"></div>
<p><button id="abort">Abort</button>
`;
    pageContent.innerHTML = content;
    document.querySelector("#abort").onclick = reset;
}

function doArchive() {
    let downloadDir = document.querySelector('#directory').value;
    if (downloadDir != "" && !downloadDir.endsWith('/')) {
        downloadDir += '/';
    }
    console.log(`downloading to ${downloadDir}`);

    const format = document.querySelector('#format').value;

    chrome.storage.local.set({ archiving: true, downloadDir: downloadDir });
    chrome.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => chrome.tabs.sendMessage(tab.id, {type: 'begin', format: parseInt(format) }))
}
