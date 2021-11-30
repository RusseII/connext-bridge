import { useEffect } from 'react'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'

import _ from 'lodash'
import { NxtpSdk } from '@connext/nxtp-sdk'
import { providers } from 'ethers'
import { Img } from 'react-image'
import Loader from 'react-loader-spinner'
import { FaRegHandPointRight } from 'react-icons/fa'

import { CHAINS_STATUS_DATA, CHAINS_STATUS_SYNC_DATA, SDK_DATA } from '../../reducers/types'

export default function ChainsStatus() {
  const dispatch = useDispatch()
  const { chains, chains_status, chains_status_sync, wallet, sdk, preferences } = useSelector(state => ({ chains: state.chains, chains_status: state.chains_status, chains_status_sync: state.chains_status_sync, wallet: state.wallet, sdk: state.sdk, preferences: state.preferences }), shallowEqual)
  const { chains_data } = { ...chains }
  const { chains_status_data } = { ...chains_status }
  const { chains_status_sync_data } = { ...chains_status_sync }
  const { wallet_data } = { ...wallet }
  const { signer, address } = { ...wallet_data }
  const { sdk_data } = { ...sdk }
  const { theme } = { ...preferences }

  useEffect(() => {
    if (chains_data && signer) {
      const chainConfig = {}

      for (let i = 0; i < chains_data.length; i++) {
        const _chain = chains_data[i]

        chainConfig[_chain?.chain_id] = {
          provider: new providers.FallbackProvider(_chain?.provider_params?.[0]?.rpcUrls?.filter(rpc => rpc && !rpc.startsWith('wss://') && !rpc.startsWith('ws://')).map(rpc => new providers.JsonRpcProvider(rpc)) || []),
          subgraph: _chain?.subgraph,
        }
      }

      dispatch({
        type: SDK_DATA,
        value: new NxtpSdk({ chainConfig, signer }),
      })
    }
  }, [chains_data, address])

  useEffect(() => {
    const getDataSync = async _chains => {
      if (_chains && sdk_data) {
        let chainsData

        for (let i = 0; i < _chains.length; i++) {
          const _chain = _chains[i]

          const response = !_chain.disabled && await sdk_data.getSubgraphSyncStatus(_chain.chain_id)

          chainsData = _.concat(chainsData || [], { ..._chain, ...response })
            .map(_chain => { return { ..._chain, ...(_chain.latestBlock < 0 && chains_status_data?.find(__chain => __chain?.id === _chain.id)) } })
            .filter(_chain => !chains_status_data || _chain.latestBlock > -1)
        }

        dispatch({
          type: CHAINS_STATUS_SYNC_DATA,
          value: chainsData,
        })
      }
    }

    const getData = async () => {
      if (chains_data && sdk_data) {
        const chunkSize = _.head([...Array(chains_data.length).keys()].map(i => i + 1).filter(i => Math.ceil(chains_data.length / i) <= Number(process.env.NEXT_PUBLIC_MAX_CHUNK))) || chains_data.length
        _.chunk([...Array(chains_data.length).keys()], chunkSize).forEach(chunk => getDataSync(chains_data.map((_chain, i) => { return { ..._chain, i } }).filter((_chain, i) => chunk.includes(i))))
      }
    }

    setTimeout(() => {
      getData()
    }, (chains_data && sdk_data ? 1 : 0) * 15 * 1000)

    const interval = setInterval(() => getData(), 0.5 * 60 * 1000)
    return () => {
      clearInterval(interval)
    }
  }, [chains_data, sdk_data])

  useEffect(() => {
    if (chains_status_sync_data) {
      if (chains_status_sync_data.length >= chains_data.length) {
        dispatch({
          type: CHAINS_STATUS_DATA,
          value: _.orderBy(chains_status_sync_data, ['i'], ['asc']),
        })
      }
    }
  }, [chains_status_sync_data])

  return (
    <>
      <div className="w-full h-8 xl:h-10 bg-gray-100 dark:bg-gray-900 overflow-x-auto flex items-center py-2 px-2 sm:px-4">
        {!chains_status_data && (
          address ?
            <span className="flex flex-wrap items-center font-mono text-blue-600 dark:text-blue-400 text-2xs xl:text-sm space-x-1.5 xl:space-x-2">
              <Loader type="Grid" color={theme === 'dark' ? '#60A5FA' : '#2563EB'} width="16" height="16" />
              <span>Checking Subgraph Status</span>
            </span>
            :
            <span className="font-mono text-blue-600 dark:text-blue-400 text-2xs xl:text-sm ml-auto">Please connect your wallet.</span>
        )}
        {chains_status_data?.map((chain, i) => (
          <div key={i} className="min-w-max flex items-center text-2xs xl:text-sm space-x-1.5 xl:space-x-2 mr-4">
            {chain.image && (
              <Img
                src={chain.image}
                alt=""
                className="w-4 xl:w-5 h-4 xl:h-5 rounded-full"
              />
            )}
            {chain.short_name && (
              <span className="text-gray-700 dark:text-gray-300 font-semibold">{chain.short_name}</span>
            )}
            <span className={`capitalize ${chain.disabled ? 'text-gray-400 dark:text-gray-600' : !chain.synced ? 'text-red-500 dark:text-red-600' : 'text-green-600 dark:text-green-500'}`}>
              {chain.disabled ? 'disabled' : !chain.synced ? 'unsynced' : 'synced'}
            </span>
          </div>
        ))}
      </div>
      {chains_status_data?.filter(_chain => !_chain.disabled && !_chain.synced).length > 0 && (
        <div className="xl:max-w-xl block font-mono leading-4 text-red-600 dark:text-red-500 text-2xs xl:text-sm space-y-1 xl:mx-auto py-4 xl:py-6 px-4">
          <FaRegHandPointRight size={20} className="inline mr-2" />
          <span className="mr-2">
            You may face some delay transfers due to the <span className="font-semibold">{chains_status_data?.filter(_chain => !_chain.disabled && !_chain.synced).map(_chain => _chain?.short_name).join(', ')}</span> subgraph{chains_status_data?.filter(_chain => !_chain.disabled && !_chain.synced).length > 1 ? 's' : ''} is not synced. However, no worry at all - your funds are SAFE. Simply check your transaction status at
          </span>
          <a
            href={`${process.env.NEXT_PUBLIC_EXPLORER_URL}${address ? `/address/${address}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-red-600 dark:text-red-500 font-bold"
          >
            {address ? 'View Transactions' : 'Explorer'}
          </a>.
        </div>
      )}
    </>
  )
}