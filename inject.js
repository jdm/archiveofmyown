(function() {
    let works = [];

    function retrieveWorksFromPage(document, pageNumber) {
        const works = document.querySelectorAll("ol.work li.work");
        let workUrls = [];
        for (const work of works) {
            const id = work.id.split("_")[1];
            const url = `https://archiveofourown.org/works/${id}`;
            workUrls.push(url);
        }
        chrome.runtime.sendMessage({
            op: 'page',
            urls: workUrls,
            pageNum: pageNumber,
        });
        // FIXME
        //return [workUrls[0]];
        return workUrls;
    }

    function handleWork(document, format) {
        console.log("fetching download URL");
        const downloadButton = document.querySelector(`.download .expandable > li:nth-child(${format}) > a:nth-child(1)`);
        chrome.runtime.sendMessage({
            'op': 'work',
            'url': downloadButton.href.toString(),
        });
    }

    function fetchPage(url, handler) {
        console.log(`fetching ${url}`);
        fetch(url)
            .then(response => response.text())
            .then(text => {
                console.log(`parsing ${url}`);
                // TODO: detect "retry later" message
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");
                handler(doc);
            })
    }

    function handleTagPage(document, pageNum) {
        console.log(`retrieving all works for page ${pageNum}`);
        works = works.concat(retrieveWorksFromPage(document, pageNum));
    }

    let pageInterval = null;
    let worksInterval = null;
    function beginArchiving(format) {
        console.log("Starting archival process.");

        let baseTagPage = new URL(location.href);
        // TODO: support noncanonical tags, tags with less than one page of content
        // https://archiveofourown.org/tags/International%20Wizarding%20World%20Thinks%20Dumbledore%20is%20Sus
        const pages =  document.querySelector('.pagination .next').previousElementSibling;
        const numPages = parseInt(pages.textContent);
        chrome.runtime.sendMessage({
            op: "pages",
            count: numPages,
        });

        worksInterval = setInterval(() => {
            if (works.length === 0) {
                return;
            }
            // TODO: retry if failed.
            fetchPage(works.shift(), (doc) => handleWork(doc, format));
        }, 2000)

        let nextPage = 2;
        pageInterval = setInterval(() => {
            if (nextPage > numPages) {
                return;
            }
            // TODO: retry if failed.
            const page = nextPage;
            nextPage += 1;
            baseTagPage.searchParams.set("page", page);
            fetchPage(baseTagPage.toString(), (doc) => handleTagPage(doc, page));
            // FIXME
            //clearInterval(pageInterval);
        }, 3000)

        handleTagPage(document, 1);
    }

    chrome.runtime.onMessage.addListener(message => {
        switch (message.type) {
        case 'begin':
            beginArchiving(message.format);
            break;
        case 'stop':
            if (pageInterval != null) {
                clearInterval(pageInterval);
            }
            if (worksInterval != null) {
                clearInterval(worksInterval);
            }
            break;
        }
    });
}());
