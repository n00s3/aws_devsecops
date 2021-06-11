import React from 'react'
import papaparse from 'papaparse';
const DownloadAnonymizationData = props => {

    const { arxResp } = props

    const handleDownloadCSV = () => {
        var csv = papaparse.unparse(arxResp.anonymizeResult.data,{delimiter: ";"});
        console.log("Downloading csv")
        const element = document.createElement("a");
        let csvData = new Blob([csv], {type: 'text/plain'});
        element.href = URL.createObjectURL(csvData);
        element.download = "myFile.txt";
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();

    }

    let content = (
        <div>
            <h1>Download data</h1>
            <button onClick={(e) => handleDownloadCSV(e)}>
                Export Anonymized Data as CSV
        </button>
        </div>
    )
    return content
}
export default DownloadAnonymizationData