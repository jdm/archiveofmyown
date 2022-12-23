let tag = null;
let pageContent = null;

function reset() {
    chrome.runtime.sendMessage({ op: "reset" });
    chrome.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => chrome.tabs.sendMessage(tab.id, {type: 'stop'}))
    setTimeout(() => setup(), 1000);
}

async function setup() {
    // TODO: ensure page query param is absent, always start at first page
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
    }).then(({ currentPage, works, downloadUrls, downloadIndex, pages, archiving }) => {
        if (!archiving) {
            return;
        }
        updateContent(currentPage, works, downloadUrls, downloadIndex, pages);
    })
}

chrome.storage.onChanged.addListener((changes, area) => {
    loadUpdatedValues();
});

(async () => setup())();

function updateContent(currentPage, works, downloadUrls, downloadIndex, pages) {
    if (currentPage == pages &&
        downloadUrls.length == works.length &&
        downloadIndex == downloadUrls.length)
    {
        pageContent.innerHTML = `Archiving complete.`;
        return;
    }
    const content = `
<h5>Archiving <u>${tag}</u>...</h5>
<p>Scanned ${currentPage}/${pages != null ? pages : "??"} pages for works.
<p>Retrieved ${downloadUrls.length}/${works.length} download links.
<p>Started ${downloadIndex}/${downloadUrls.length} downloads.
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

    chrome.storage.local.set({ archiving: true, downloadDir: downloadDir });
    chrome.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => chrome.tabs.sendMessage(tab.id, {type: 'begin'}))
}
