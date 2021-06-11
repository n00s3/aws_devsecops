import React from 'react'
import ReactTable from "react-table";
import 'react-table/react-table.css'

const AttributeGeneralization = props => {

    const {attributeGeneralization} = props;
    const columns = [{
        Header: 'Name',
        accessor: 'name'
    },{
        Header: 'Type',
        accessor: 'type'
    },{
        Header: 'Generalization level',
        accessor: 'generalizationLevel'
    }];

    let content = (
        <div>
            <h3>Attribute Generalization</h3>
            <ReactTable
                data = {attributeGeneralization}
                columns = {columns}
                defaultPageSize={5}
            />
        </div>
    );
    return content;
};
export default AttributeGeneralization;