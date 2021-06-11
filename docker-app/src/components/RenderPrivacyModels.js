import React from 'react'

const PrivacyModelManager = (props) => {
    const { privacyModels, handlePrivacyRemove } = props;


    let content = (
        <div>
            <table border="1">
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Params</th>
                    </tr>
                </thead>
                <tbody>
                    {privacyModels.map((model, index) => {
                        return (<tr key={index}>
                            <td>{model.privacyModel}</td>
                            <td>{JSON.stringify(model.params)}</td>
                            <td>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handlePrivacyRemove(index)}>Remove</button>
                            </td>
                        </tr>)
                    })}
                </tbody>
            </table>
        </div>
    );
    return content
};

export default PrivacyModelManager