/* eslint-disable no-param-reassign */
import React from 'react';
import { pick, mapValues, inject }  from './utils';

export const ReactComponentFunctionNames = [
  'componentDidMount',
  'componentWillUnmount',
  'componentDidUpdate',
  'shouldComponentUpdate',
];

function normalizeListener(listener) {
  if (listener === undefined) return
  return Array.isArray(listener) ? listener : [listener]
}

function normalizeListenerResult(result) {
  return Array.isArray(result) ? result : [result]
}

export function wrap(DeclarativeComponent) {
  const {
    displayName,
    defaultStateTypes = {},
    getDefaultState = () => ({}),
    defaultListeners = {},
    defaultIntercepters = {},
    defaultWrappers = {},
    initialize = () => ({}),
    render,
  } = DeclarativeComponent;

  class LegoWrapper extends React.Component {
    static displayName = displayName
    constructor(props) {
      super(props)

      this.instance = initialize()
      this.setupLifeCycles()

      this.setupListeners()
      this.setupIntercepters()
      const stateValueNames = Object.keys(defaultStateTypes)
      this.state = {...getDefaultState(), ...pick(props, (_, name) => stateValueNames.includes(name))}
    }

    pickListenerArg = () => {
      return pick(this, ['state', 'instance'])
    }

    pickRenderArg = () => {
      return pick(this, ['state', 'instance', 'listeners', 'intercepters'])
    }

    setupLifeCycles() {
      ReactComponentFunctionNames.forEach(name => {
        if (DeclarativeComponent[name] !== undefined) {
          this[name] = inject(DeclarativeComponent[name], this.pickRenderArg)
        }
      })
    }

    setupListeners() {
      this.listeners = mapValues(defaultListeners, (defaultListener, name) => {
        return (...runtimeArgs) => {
          const listenerArg = this.pickListenerArg()
          const normalizedResult = normalizeListener(this.props[name])

          if (normalizedResult=== undefined ) return this.handleListenerResult(defaultListener(listenerArg, ...runtimeArgs))

          const [listener, preventDefault = false, before = false] = normalizedResult
          if (preventDefault === true) return listener !== undefined ? this.handleListenerResult((listener(listenerArg, ...runtimeArgs))) : undefined

          if (before === false) {
            const nextState = defaultListener(listenerArg, ...runtimeArgs)
            const nextArg = {
              ...listenerArg,
              state: {
                ...listenerArg.state,
                ...nextState
              }
            }

            const listenerResult = listener(nextArg, ...runtimeArgs)

            return this.handleListenerResult(listenerResult === undefined ? nextState : listenerResult)
          }

          const listenerResult = normalizeListenerResult(listener(listenerArg, ...runtimeArgs))
          if (listenerResult === undefined) return

          const [nextState={}, preventDefaultOnFly = false] = listenerResult
          if (preventDefaultOnFly) return this.handleListenerResult(nextState)

          const nextArg = {
            ...listenerArg,
            state: {
              ...listenerArg.state,
              ...nextState
            }
          }

          const defaultListenerResult = defaultListener(nextArg, ...runtimeArgs)
          return this.handleListenerResult(defaultListenerResult === undefined ? nextState : defaultListenerResult)
        }
      })
    }

    setupIntercepters() {
      this.intercepters = mapValues(
        defaultIntercepters,
        (defaultIntercepter, name) => inject(
          this.props[name] === undefined ? defaultIntercepter : this.props[name],
          this.pickListenerArg
        )
      )
    }

    handleListenerResult(result) {
      if (typeof result === 'object') {
        this.setState(result)
      }
    }

    render() {
      const wrappers = mapValues(defaultWrappers, (wrapper, name) => (this.props[name] === undefined ? wrapper : this.props[name]))
      return render({
        ...this.pickRenderArg(),
        children: this.props.children,
        wrappers
      });
    }
  }

  LegoWrapper.propTypes = defaultStateTypes;

  return LegoWrapper;
}
