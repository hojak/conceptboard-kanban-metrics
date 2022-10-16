# Conceptboard Tools for Kanban

This repository provides a simple javascript snippet to be inserted into conceptboard e.g. via the tampermonkey plugin for google chrome.


## Getting Starded

### Collecting Data
The tooling relies on manually collected data about ticket. This means, for every ticket, a simple text box has to be maintained, respecting a certain format.

Example

```
MetricsType: reality
selected: 2021-04-26 13:30
work: 2021-04-26 15:30
work end: 2021-04-26 15:40
done: 2021-04-27 10:15
```

Description:
* The text needs to start with `MetricsType: `.
* The keyword following `MetricsType` will be used ad card or working type to classify cards.
* Afterward, pairs of status and timestamp can be listed.
* The timestamps must follow the format YYYY-MM-DD hh:ii


### Inserting the Scripts into Conceptboard
Currently, two ways of inserting the script into conceptboard are tested:

**Direct Injection via Javascript Console**

You can simply copy the contents of the file `src/tampermonkey-script.sh` into the javaacript console inside the scope of your conceptboard.

**Usage of Tampermonkey**
You can use tampermonkey to be integrated into conceptboard automatically. Make sure to adapt the domain name of your concept board account in the script file, if your using an enterprise account with a unique subdomain of conceptboard.

### Usage
After a successful integration, you can see three additional buttons in the top icon bar of concept board.

Click the to get the diagram with statistics about all cards **that are
currently in or near your actual selected view of the board**.

**Example for a CFD**

![Example for a CFD](doc/example_cfd.png)


## Links
- Conceptboard: https://conceptboard.com/
- Tampermonkey: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=de