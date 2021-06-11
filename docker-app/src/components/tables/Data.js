import React from 'react'
import ReactTable from "react-table";
import 'react-table/react-table.css'
const Data = props => {

    const { arxResp } = props;
    const columns = Object.keys(arxResp.anonymizeResult.data[0]).map((key, id)=>{
        return {
          Header: arxResp.anonymizeResult.data[0][key],
          accessor: key
        }
      })

      let data = arxResp.anonymizeResult.data.slice(1)

    let content = (
        <div>
            <h3>Anonymization Data</h3>
            <ReactTable
                data={data}
                columns={columns}
            />
        </div>
    )
    return content
}
export default Data