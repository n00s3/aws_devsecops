import React from 'react'

const RenderSuppressionLimit = (props) => {

    const {suppressionLimit,handleSuppressionLimitAdd,handleSuppressionLimitRemove} = props;

    const content = (
        <div>
            <label>Limit:</label>
            <input type='number' id="limit" min="0" max="1" step="0.001" />
            <button className="btn btn-outline-primary" onClick={() => handleSuppressionLimitAdd(document.getElementById("limit").value)}>Add Suppression Limit</button>
            <br />
            <label> Suppression Limit: {suppressionLimit}</label>
            <br />
            <button className="btn btn-danger btn-sm"  onClick={() => handleSuppressionLimitRemove()}>Remove</button>
        </div>
    );
    return content;
}
export default RenderSuppressionLimit;