import React from 'react'
import 'bootstrap/dist/css/bootstrap.css';
import {Row, Col, Container} from 'reactstrap'
import DistributionOfRisk from './tables/DistributionOfRisk';
import ReIdentificationRisk from './tables/ReIdentificationRisk';
const AnalyzeResult = props => {
    const { arxResp } = props;
    let content = (
        <div>
        <h4>Analyze</h4>
        <Container>
            <Row>
                <Col sm={5}>
                    <ReIdentificationRisk reIdentificationRisk={arxResp.reIdentificationRisk} />
                </Col>
                <Col sm={1}></Col>
                <Col sm={6}>
                <DistributionOfRisk riskIntervalList={arxResp.distributionOfRisk.riskIntervalList} />
                </Col>
            </Row>
        </Container>
        <br />
    </div>
    );
    return content
};
export default AnalyzeResult