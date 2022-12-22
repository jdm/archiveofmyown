let tag = null;
let pageContent = null;
let downloadDir = null;

function reset() {
    browser.runtime.sendMessage({ op: "reset" });
    browser.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => browser.tabs.sendMessage(tab.id, {type: 'stop'}))
    setup();
}

async function setup() {
    // TODO: ensure page query param is absent, always start at first page
    pageContent = document.querySelector('#page-content');
    const [currentTab] =
          await browser.tabs.query({active: true, currentWindow: true});
    const url = new URL(currentTab.url);
    const pathParts = url.pathname.split('/');
    tag = decodeURIComponent(pathParts[2].replace('*s*', '/'));

    const data = await browser.storage.local.get({ "archiving": false });
    if (data.archiving) {
        loadUpdatedValues();
        return;
    }

    pageContent.innerHTML =
        `
  <!--<label for="directory">Download directory:</label> <input id="directory" type="file" webkitdirectory>-->
  <p><button id="archive">Archive</button>
  <p><button id="reset">Reset</button>
`

    const button = document.querySelector("#archive");
    button.textContent = `Archive ${tag}`;
    button.onclick = doArchive;

    const resetButton = document.querySelector("#reset");
    resetButton.onclick = reset;

    /*const input = document.querySelector("#directory");
    input.onchange = (event) => {
        downloadDir = event.target.files[0].webkitRelativePath;
        console.log(`downloading to ${downloadDir}`);
        button.removeAttribute("disabled");
    };*/
}

(async () => setup())();

function loadUpdatedValues() {
    browser.storage.local.get({
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

browser.storage.onChanged.addListener((changes, area) => {
    loadUpdatedValues();
});

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
<p><button id="abort">Abort</button>
`;
    pageContent.innerHTML = content;
    document.querySelector("#abort").onclick = reset;
}

function doArchive() {
    browser.storage.local.set({ archiving: true });
    browser.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => browser.tabs.sendMessage(tab.id, {type: 'begin'}))
}
