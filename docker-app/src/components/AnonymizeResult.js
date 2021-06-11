import React from 'react'
import 'bootstrap/dist/css/bootstrap.css';
import DistributionOfRisk from './tables/DistributionOfRisk';
import DownloadAnonymizationData from './DownloadAnonymizationData';
import Data from './tables/Data'
import ReIdentificationRisk from "./tables/ReIdentificationRisk";
import MetricsAttributeGeneraliztion from "./tables/MetricsAttributeGeneralization"
import {Row, Col, Container} from "reactstrap";
import PrivacyModels from "./tables/MetricsPrivacyModel";

const anonymizeResult = props => {
    const { arxResp } = props;
    let content = (
        <div>
            <h4>Anonymize Result</h4>
            <p>Anonymization Status:  <b>{arxResp.anonymizeResult.anonymizationStatus}</b></p>
            <Data arxResp={arxResp}/>
            <DownloadAnonymizationData arxResp={arxResp} />
            <Container>
                <Row>
                    <Col sm={5}>
                        <ReIdentificationRisk reIdentificationRisk={arxResp.riskProfile.reIdentificationRisk} />
                    </Col>
                    <Col sm={1}></Col>
                    <Col sm={6}>
                        <DistributionOfRisk riskIntervalList={arxResp.riskProfile.distributionOfRisk.riskIntervalList} />
                    </Col>
                </Row>
            </Container>
            <h2>Anonymization Metrics</h2>
            <p>Process Time: <b>{arxResp.anonymizeResult.metrics.processTimeMillisecounds} ms</b></p>
            <MetricsAttributeGeneraliztion attributeGeneralization={arxResp.anonymizeResult.metrics.attributeGeneralization} />
            <PrivacyModels privacyModels={arxResp.anonymizeResult.metrics.privacyModels} />
        </div>
    );

    return content
};
export default anonymizeResult
