import React from 'react'

import 'bootstrap/dist/css/bootstrap.css';


import AnonymizeResult from './AnonymizeResult'
import AnalyzeResult from './AnalyzeResult';
const Result = props => {
    const { arxResp } = props

    let renderAction = (action) => {
        if (action === 'anonymize' && arxResp.anonymizeResult) {
            return (<div><h1>Anonymize</h1> <AnonymizeResult arxResp={arxResp} /></div>)
        } else if (action === 'analyze' && arxResp.reIdentificationRisk) {
            return (<AnalyzeResult arxResp={arxResp}/> );
        } else if (arxResp.message) {
            return (<div><b>Something went wrong. Error:</b> {arxResp.message}</div>)
        } else {
            return (<p>No action taken</p>)
        }
    }
    return renderAction(props.action)
}
export default Result
