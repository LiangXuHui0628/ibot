import React from 'react'
import PropTypes from 'prop-types'

export default class ColorInput extends React.Component {
  render () {
    const { label, maxLength, size, value } = this.props
    return (
      <div className="color-input Hex_value">
        <label htmlFor="">{label}</label>
        <input type="text" {...{maxLength, size, value}} />
      </div>
    )
  }
}

ColorInput.propTypes = {
  'a': PropTypes.string
}
