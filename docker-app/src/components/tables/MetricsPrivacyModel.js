import React from 'react'
import 'react-table/react-table.css'

const PrivacyModels = props => {

    const {privacyModels} = props;

    const content = (
        <div>
            <h3>Privacy Models</h3>

                    {
                        privacyModels.map((data,i) => (
                            <div key={i}>
                            <table className="table table-hover" >
                                <tbody>
                                    {Object.keys(data).map((key) => (
                                        <tr key={key}>
                                        <td>{key}</td>
                                        <td>{String(data[key])}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <br />
                            </div>
                        ))
                    }
        </div>
    );
    return content;
};
export default PrivacyModels;