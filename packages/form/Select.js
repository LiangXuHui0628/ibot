import React, { PureComponent } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import DocumentEvents from 'react-document-events'
import get from 'lodash/get'

import { EllipsisSpan } from '@mockingbot/text'
import Icon from '@mockingbot/icon'
import { trimList } from '@mockingbot/util'

import './index.styl'

const MENU_ROOT_ID = 'MB_SELECT_MENU_ROOT'
const { I18N = {} } = window

const $menuRoot = (
  document.getElementById(MENU_ROOT_ID)
  || Object.assign(document.createElement('div'), { id: MENU_ROOT_ID })
)

const $body = document.body

if (!$body.contains($menuRoot)) {
  $body.appendChild($menuRoot)
}

function getOptionEntry(optionList, idx, def) {
  return get(optionList, idx, def)
}

export default class Select extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
      currentOptionIdx: props.currentOptionIdx,
    }
  }

  static propTypes = {
    className: PropTypes.string,
    menuClassName: PropTypes.string,
    placeholder: PropTypes.string,

    /**
     * A valid option list looks like either one below:
     *
     * ['Apple', 'Pencil']
     * ['Apple', { label: <span>Pencil <Icon name="pencil"/></span>, value: 'pencil' }]
     * [{ label: 'Apple', isDisabled: true }, 'Pencil']
     *
     * [
     *  'An apple',
     *  [
     *    'Stationery', // First entry of an array is the title of the group.
     *    'A pen',
     *    'A marker',
     *    {
     *      label: <span>A pencil <Icon name="pencil"/></span>,
     *      value: 'pencil',
     *      isDisabled: true
     *    },
     *  ],
     *  { label: 'Blackberries' },
     * ]
     *
     */
    optionList: PropTypes.arrayOf(
      PropTypes.oneOfType([
        // Regular options:
        PropTypes.node,
        PropTypes.shape({
          label: PropTypes.node,
          value: PropTypes.any,
          isDisabled: PropTypes.bool,
        }),

        // Option groups:
        PropTypes.arrayOf(
          PropTypes.oneOfType([
            PropTypes.node,
            PropTypes.shape({
              label: PropTypes.node,
              value: PropTypes.any,
              isDisabled: PropTypes.bool,
            }),
          ])
        ),
      ])
    ).isRequired,

    currentOptionIdx: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),
    isDisabled: PropTypes.bool,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    className: '',
    menuClassName: '',
    placeholder: I18N.select_placeholder || 'Choose one…',
    emptyMsg: I18N.select_empty_msg || 'Nothing to display…',
    optionList: [],
    isDisabled: false,
    onChange: () => null,
  }

  componentWillMount() {
    window.addEventListener('resize', this.onResizeWindow)
  }

  componentWillReceiveProps({ currentOptionIdx: nextOptionIdx }) {
    const { currentOptionIdx } = this.state

    if (currentOptionIdx !== nextOptionIdx) {
      this.setState({ currentOptionIdx: nextOptionIdx })
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResizeWindow)
  }

  set$select = $select => this.setState({ $select })

  open = () => this.setState({ isOpen: true })
  close = () => this.setState({ isOpen: false })
  toggle = () => this.setState({ isOpen: !this.state.isOpen })

  onResizeWindow = () => this.state.isOpen && this.close()

  onClickOutside = ({ target }) => (
    !$menuRoot.contains(target)
    && !(target.closest('label') && this.state.$select.contains(target))
    && this.close()
  )

  onScrollOutside = () => (
    this.state.isOpen
    && this.canCloseOnScrollOutside
    && this.close()
  )

  checkCursorPoint = ({ clientX, clientY }) => (
    Object.assign(this, {
      canCloseOnScrollOutside: !document.elementFromPoint(clientX, clientY).matches('.SelectMenu.is-open *')
    })
  )

  onChange = idx => this.setState(
    { currentOptionIdx: idx },
    () => {
      const { optionList, onChange } = this.props

      this.close()
      onChange(optionList[idx], idx)
    },
  )

  onSelect = ({ currentTarget: $opt }) => (
    this.onChange($opt.dataset.idx)
  )

  render() {
    const {
      className,
      menuClassName,
      isDisabled,
      optionList,
      placeholder,
    } = this.props

    const { isOpen, currentOptionIdx, $select } = this.state

    const option = get(optionList, currentOptionIdx, placeholder)
    const displayText = option.label || option

    const klass = trimList([
      'Select',
      className,
      isOpen ? 'is-open' : '',
      isDisabled ? 'is-disabled' : '',
    ])

    return (
      <label
        className={klass}
        role="listbox"
        ref={this.set$select}
      >
        <button type="button" onClick={this.toggle} disabled={isDisabled}>
          <EllipsisSpan>{ displayText }</EllipsisSpan>
        </button>

        <Icon type="fa" name="caret-down" className="Select-caret" />

        <SelectMenu
          isOpen={isOpen}
          {...this.props}
          $select={$select}
          onChange={this.onSelect}
          currentOptionIdx={currentOptionIdx}
        />

        {/* 点击下拉菜单以外的地方时, 收起下拉菜单 */}
        { isOpen && (
          <DocumentEvents
            onMouseDown={this.onClickOutside}
            onMouseOver={this.checkCursorPoint}
            onScroll={this.onScrollOutside}
          />
        )}
      </label>
    )
  }
}

class SelectMenu extends PureComponent {
  constructor(props) {
    super(props)

    Object.assign(this, {
      portal: Object.assign(
        document.createElement('div'),
        { className: 'SelectMenuPortal' },
      ),
    })
  }

  static propTypes = {
    ...Select.propTypes,
    isOpen: PropTypes.bool,
    onChange: PropTypes.func,
    $select: PropTypes.instanceOf(Element),
  }

  static defaultProps = {
    isOpen: false,
  }

  componentWillMount() {
    $menuRoot.appendChild(this.portal)
  }

  componentWillReceiveProps({ isOpen: willBeOpen, $select }) {
    const { $menu } = this
    const { isOpen } = this.props

    // Set up the min-width of the <Select> once mounted:
    this.size$select($select)

    // Set up the position of the <SelectMenu> once opened:
    if (!isOpen && willBeOpen) {
      this.position$menu()
    }
  }

  componentWillUnmount() {
    if (this.portal) this.portal.remove()
  }

  set$menu = $menu => Object.assign(this, { $menu })
  set$menuStyle = style => Object.assign(this.$menu.style, style)

  size$select = ($select = this.props.$select) => {
    const { $menu } = this

    if (!$select || !$menu) return

    const { offsetWidth: wOf$menu, offsetHeight: hOf$menu } = $menu
    const { offsetWidth: wOf$select, offsetHeight: hOf$select } = $select

    const minW = Math.max(wOf$select, wOf$menu)
    const maxY = window.innerHeight - 10

    Object.assign($select.style, { minWidth: `${minW}px` })
  }

  position$menu = () => {
    const { $select } = this.props
    const { $menu } = this

    if (!$select || !$menu) return

    const { offsetWidth: wOf$menu, offsetHeight: hOf$menu } = $menu
    const { offsetWidth: wOf$select, offsetHeight: hOf$select } = $select
    const { top, bottom, left } = $select.getBoundingClientRect()
    const { innerHeight: hOf$win } = window

    const minW = Math.max(wOf$select, wOf$menu)
    const minY = 10
    const maxY = hOf$win - 10

    // Y middle line of the <Select>:
    const midOf$select = top + hOf$select/2

    // Deciding point which separates menus going upward or downward:
    const decidingPoint = hOf$win * 2/3

    // Set X position, etc:
    this.set$menuStyle({ left: `${left}px`, minWidth: `${minW}px` })

    // Slide downward:
    if (decidingPoint >= midOf$select) {
      this.set$menuStyle({ top: `${bottom}px` })

      // If the height of the menu is taller than that of space downward:
      if (bottom + hOf$menu > maxY) {
        this.set$menuStyle({ maxHeight: `${maxY - bottom}px` })
      }

    // Slide upward:
    } else {
      this.set$menuStyle({ top: '', bottom: `${hOf$win - top}px` })

      // If the height of the menu is taller than that of space upward:
      if (top - hOf$menu < minY) {
        this.set$menuStyle({ maxHeight: `${top - minY}px` })
      }
    }

    const $current = this.$menu.querySelector('li[role=option].is-active')
    if ($current) {
      $current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  onTransitionEnd = () => (
    // Clean up inline styles for <SelectMenu> once closed:
    !this.props.isOpen && this.$menu.removeAttribute('style')
  )

  render() {
    return createPortal(this.renderMenu(), this.portal)
  }

  renderMenu() {
    const {
      isOpen,
      isDisabled,
      menuClassName,
      optionList,
      emptyMsg,
      onChange,
      currentOptionIdx,
    } = this.props

    const isEmpty = optionList.length === 0

    const klass = trimList([
      'SelectMenu',
      menuClassName,
      isOpen ? 'is-open' : '',
      isDisabled ? 'is-disabled' : '',
      isEmpty ? 'is-empty' : '',
    ])

    return (
      <ul
        className={klass}
        ref={this.set$menu}
        onTransitionEnd={this.onTransitionEnd}
      >
      {
        isEmpty
        ? <li className="SelectOption empty-msg">{ emptyMsg }</li>
        : (
          optionList
          .map((opt, idx) => (
            Array.isArray(opt)
            ? (
              <Group
                key={idx}
                idx={idx}
                optionList={opt}
                onChange={onChange}
                currentOptionIdx={currentOptionIdx}
              />
            )
            : (
              <Option
                key={idx}
                idx={idx}
                label={opt.label || opt}
                value={opt.value}
                isDisabled={opt.isDisabled}
                onChange={onChange}
                currentOptionIdx={currentOptionIdx}
              />
            )
          ))
        )
      }
      </ul>
    )
  }
}

function Group({
  idx: groupIdx,
  optionList: [title, ...optionList],
  onChange,
  currentOptionIdx,
}) {
  return (
    <li className="SelectGroup">
      <div className="title">{ title }</div>

      <ul>
      {
        optionList
        .map((opt, idx) => (
          <Option
            key={idx}
            idx={`${groupIdx}.${idx + 1}`}
            label={opt.label || opt}
            value={opt.value}
            isDisabled={opt.isDisabled}
            onChange={onChange}
            currentOptionIdx={currentOptionIdx}
          />
        ))
      }
      </ul>
    </li>
  )
}

Group.propTypes = {
  idx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  optionList: PropTypes.array,
  onChange: PropTypes.func,
  currentOptionIdx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

function Option({
  idx,
  label,
  value,
  isDisabled,
  onChange,
  currentOptionIdx,
}) {

  const className = trimList([
    'SelectOption',
    isDisabled ? 'is-disabled' : '',
    String(currentOptionIdx) === String(idx) ? 'is-active' : '',
  ])

  return (
    <li
      role="option"
      data-idx={idx}
      className={className}
      onClick={onChange}
    >
      <EllipsisSpan>{ label }</EllipsisSpan>
    </li>
  )
}

Option.propTypes = {
  idx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  label: PropTypes.node.isRequired,
  value: PropTypes.any,
  isDisabled: PropTypes.bool,
  onChange: PropTypes.func,
  currentOptionIdx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}