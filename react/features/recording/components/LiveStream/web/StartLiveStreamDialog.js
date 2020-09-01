// @flow
/* global config */

import { Checkbox } from '@atlaskit/checkbox';
import { FieldTextStateless } from '@atlaskit/field-text';
import Spinner from '@atlaskit/spinner';
import Tabs from '@atlaskit/tabs';
import React from 'react';

import { Dialog } from '../../../../base/dialog';
import { translate } from '../../../../base/i18n';
import { connect } from '../../../../base/redux';
import {
    GOOGLE_API_STATES,
    GoogleSignInButton,
    loadGoogleAPI,
    requestAvailableYouTubeBroadcasts,
    requestLiveStreamsForYouTubeBroadcast,
    showAccountSelection,
    signIn,
    updateProfile
} from '../../../../google-api';
import AbstractStartLiveStreamDialog, {
    _mapStateToProps as _abstractMapStateToProps,
    type Props as AbstractProps
} from '../AbstractStartLiveStreamDialog';

import StreamKeyForm from './StreamKeyForm';
import StreamKeyPicker from './StreamKeyPicker';

type Props = AbstractProps & {

    /**
     * The ID for the Google client application used for making stream key
     * related requests.
     */
    _googleApiApplicationClientID: string
}

/**
 * A React Component for requesting a YouTube stream key to use for live
 * streaming of the current conference.
 *
 * @extends Component
 */
class StartLiveStreamDialog
    extends AbstractStartLiveStreamDialog<Props> {

    _tabs: Object[]
    _currentTab: number

    /**
     * Initializes a new {@code StartLiveStreamDialog} instance.
     *
     * @param {Props} props - The React {@code Component} props to initialize
     * the new {@code StartLiveStreamDialog} instance with.
     */
    constructor(props: Props) {
        super(props);

        // Bind event handlers so they are only bound once per instance.
        this._onGetYouTubeBroadcasts = this._onGetYouTubeBroadcasts.bind(this);
        this._onInitializeGoogleApi = this._onInitializeGoogleApi.bind(this);
        this._onGoogleSignIn = this._onGoogleSignIn.bind(this);
        this._onRequestGoogleSignIn = this._onRequestGoogleSignIn.bind(this);
        this._onYouTubeBroadcastIDSelected
            = this._onYouTubeBroadcastIDSelected.bind(this);


        this._onSelectTab = this._onSelectTab.bind(this);
        this._tabs = [ { name: 'youtube' } ];

        console.debug('config.streamingServers:', config.streamingServers);
        if (config.streamingServers && config.streamingServers.length) {
            const customTabs = config.streamingServers.map(serverConfig => {
                return { label: serverConfig.label || serverConfig.name };
            });

            this._tabs = customTabs;
        }
        const tabIndex = JSON.parse(window.localStorage.getItem('recorder/currentTab') || '0');

        this._currentTab = tabIndex;
        const streamUrl = config.streamingServers[tabIndex]
            ? config.streamingServers[tabIndex].url
            : '';

        this.state.streamUrl = streamUrl;
        this.state.selectedBoundStreamID = undefined;
    }

    /**
     * Implements {@link Component#componentDidMount()}. Invoked immediately
     * after this component is mounted.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidMount() {
        super.componentDidMount();

        if (this.props._googleApiApplicationClientID) {
            this._onInitializeGoogleApi();
        }
    }


    /**
     * Implements {@code Component}'s render.
     *
     * @inheritdoc
     */
    render() {
        // this._tabs[0].content = this._renderYouTubeTab();

        let i = 0;

        if (config.streamingServers && config.streamingServers.length) {
            for (const serverConfig of config.streamingServers) {
                this._tabs[i++].content = serverConfig.name === 'youtube'
                    ? this._renderYouTubeTab()
                    : this._renderCustomTab(serverConfig);
            }
        }

        // this._tabs[i].content = this._renderCustomTab();

        return (
            <Dialog
                cancelKey = 'dialog.Cancel'
                okKey = 'dialog.startLiveStreaming'
                onCancel = { this._onCancel }
                onSubmit = { this._onSubmit }
                titleKey = 'liveStreaming.start'
                width = { 'small' }>
                <div className = 'live-stream-dialog'>
                    <Tabs
                        defaultSelected = { this._currentTab }
                        onSelect = { this._onSelectTab }
                        tabs = { this._tabs } />

                </div>
            </Dialog>
        );
    }

    _onSelectTab: (Object, number) => void;

    /**
     * Saves tab selection.
     *
     * @param  {Tab} _tab - Selected Tab object.
     * @param  {integer} index - Index of selected tab.
     * @returns {void}
     */
    _onSelectTab(_tab, index) {
        console.debug('Selected tab', index + 1);
        if (typeof index !== 'undefined') {
            window.localStorage.setItem('recorder/currentTab', JSON.stringify(index));
            this._currentTab = index;

            const streamUrl = config.streamingServers[index]
                ? config.streamingServers[index].url
                : '';

            console.debug('setting streamUrl:', streamUrl);

            this.setState({
                streamUrl,
                selectedBoundStreamID: undefined
            });
        }
    }

    /**
     * Loads tab for streaming to YouTube.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderYouTubeTab() {
        const { _googleApiApplicationClientID } = this.props;

        return (
            <div>
                { _googleApiApplicationClientID
                    ? this._renderYouTubePanel() : null }
                <StreamKeyForm
                    onChange = { this._onStreamKeyChange }
                    value = {
                        this.state.streamKey || this.props._streamKey
                    } />
            </div>
        );
    }

    /**
     * Loads tab for streaming to custom RTMP server.
     *
     * @private
     * @param {Object} serverConfig - Configuration for custom RTMP server.
     * @example
     * ```
     * {
     *     name: 'facebook',
     *     label: 'Facebook Live', // optional
     *     url: 'rtmps://live-api-s.facebook.com:443/rtmp/', // optional
     *     useAuth: false // optional
     * }
     * ```
     * @returns {ReactElement}
     */
    _renderCustomTab(serverConfig = {}) {
        const { t } = this.props;

        return (
            <div>
                <FieldTextStateless
                    compact = { true }
                    disabled = { serverConfig.url && serverConfig.url.length }
                    isSpellCheckEnabled = { false }
                    label = { t('dialog.streamUrl') }
                    name = 'streamUrl'
                    onChange = { this._onStreamUrlChange }
                    placeholder = { t('liveStreaming.enterStreamUrl') }
                    shouldFitContainer = { true }
                    type = 'text'
                    value = { serverConfig.url || this.state.streamUrl || this.props._streamUrl } />

                <FieldTextStateless
                    compact = { true }
                    isSpellCheckEnabled = { false }
                    label = { t('dialog.streamKey') }
                    name = 'streamId'
                    onChange = { this._onStreamKeyChange }
                    placeholder = { t('liveStreaming.enterStreamId') }
                    shouldFitContainer = { true }
                    type = 'text'
                    value = { this.state.streamKey || this.props._streamKey } />
                { serverConfig.useAuth
                    ? <div className = 'section-spacer'>

                        <Checkbox
                            isChecked = { this.state.authRequired }
                            label = 'Use authentication'
                            onChange = { this._onAuthRequiredChange } />
                        { this.state.authRequired
                            ? <div>
                                <FieldTextStateless
                                    compact = { true }
                                    isSpellCheckEnabled = { false }
                                    label = 'Username'
                                    name = 'stream-username'
                                    onChange = { this._onUsernameChange }
                                    placeholder = { 'Streaming server username' }
                                    shouldFitContainer = { true }
                                    type = 'text'
                                    value = { this.state.username || this.props._username } />
                                <FieldTextStateless
                                    compact = { true }
                                    isSpellCheckEnabled = { false }
                                    label = 'Password'
                                    name = 'stream-password'
                                    onChange = { this._onPasswordChange }
                                    placeholder = { 'Streaming server password' }
                                    shouldFitContainer = { true }
                                    type = 'password'
                                    value = { this.state.password || this.props._password } />
                            </div> : null
                        }
                    </div> : null
                }
            </div>
        );
    }

    _onCancel: () => boolean;

    _onSubmit: () => boolean;

    _onInitializeGoogleApi: () => void;

    /**
     * Loads the Google web client application used for fetching stream keys.
     * If the user is already logged in, then a request for available YouTube
     * broadcasts is also made.
     *
     * @private
     * @returns {void}
     */
    _onInitializeGoogleApi() {
        this.props.dispatch(loadGoogleAPI())
        .catch(response => this._parseErrorFromResponse(response));
    }

    /**
     * Automatically selects the input field's value after starting to edit the
     * display name.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidUpdate(previousProps) {
        if (previousProps._googleAPIState === GOOGLE_API_STATES.LOADED
            && this.props._googleAPIState === GOOGLE_API_STATES.SIGNED_IN) {
            this._onGetYouTubeBroadcasts();
        }
    }

    _onGetYouTubeBroadcasts: () => void;

    /**
     * Asks the user to sign in, if not already signed in, and then requests a
     * list of the user's YouTube broadcasts.
     *
     * @private
     * @returns {void}
     */
    _onGetYouTubeBroadcasts() {
        this.props.dispatch(updateProfile())
            .catch(response => this._parseErrorFromResponse(response));

        this.props.dispatch(requestAvailableYouTubeBroadcasts())
            .then(broadcasts => {
                this._setStateIfMounted({
                    broadcasts
                });

                if (broadcasts.length === 1) {
                    const broadcast = broadcasts[0];

                    this._onYouTubeBroadcastIDSelected(broadcast.boundStreamID);
                }
            })
            .catch(response => this._parseErrorFromResponse(response));
    }

    _onGoogleSignIn: () => Object;

    /**
     * Forces the Google web client application to prompt for a sign in, such as
     * when changing account, and will then fetch available YouTube broadcasts.
     *
     * @private
     * @returns {Promise}
     */
    _onGoogleSignIn() {
        this.props.dispatch(signIn())
            .catch(response => this._parseErrorFromResponse(response));
    }

    _onRequestGoogleSignIn: () => Object;

    /**
     * Forces the Google web client application to prompt for a sign in, such as
     * when changing account, and will then fetch available YouTube broadcasts.
     *
     * @private
     * @returns {Promise}
     */
    _onRequestGoogleSignIn() {
        // when there is an error we show the google sign-in button.
        // once we click it we want to clear the error from the state
        this.props.dispatch(showAccountSelection())
            .then(() =>
                this._setStateIfMounted({
                    broadcasts: undefined,
                    errorType: undefined
                }))
            .then(() => this._onGetYouTubeBroadcasts());
    }

    _onStreamKeyChange: string => void;

    _onStreamUrlChange: string => void;
    _onUsernameChange: string => void;
    _onPasswordChange: string => void;
    _onAuthRequiredChange: boolean => void;

    _onYouTubeBroadcastIDSelected: (string) => Object;

    /**
     * Fetches the stream key for a YouTube broadcast and updates the internal
     * state to display the associated stream key as being entered.
     *
     * @param {string} boundStreamID - The bound stream ID associated with the
     * broadcast from which to get the stream key.
     * @private
     * @returns {Promise}
     */
    _onYouTubeBroadcastIDSelected(boundStreamID) {
        this.props.dispatch(
            requestLiveStreamsForYouTubeBroadcast(boundStreamID))
            .then(({ streamKey, selectedBoundStreamID }) =>
                this._setStateIfMounted({
                    streamKey,
                    selectedBoundStreamID
                }));

    }

    /**
     * Only show an error if an external request was made with the Google api.
     * Do not error if the login in canceled.
     * And searches in a Google API error response for the error type.
     *
     * @param {Object} response - The Google API response that may contain an
     * error.
     * @private
     * @returns {string|null}
     */
    _parseErrorFromResponse(response) {

        if (!response || !response.result) {
            return;
        }

        const result = response.result;
        const error = result.error;
        const errors = error && error.errors;
        const firstError = errors && errors[0];

        this._setStateIfMounted({
            errorType: (firstError && firstError.reason) || null
        });
    }

    /**
     * Renders a React Element for authenticating with the Google web client.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderYouTubePanel() {
        const {
            t,
            _googleProfileEmail
        } = this.props;
        const {
            broadcasts,
            selectedBoundStreamID
        } = this.state;

        let googleContent, helpText;

        switch (this.props._googleAPIState) {
        case GOOGLE_API_STATES.LOADED:
            googleContent
                = <GoogleSignInButton onClick = { this._onGoogleSignIn } />;
            helpText = t('liveStreaming.signInCTA');

            break;

        case GOOGLE_API_STATES.SIGNED_IN:
            if (broadcasts) {
                googleContent = (
                    <StreamKeyPicker
                        broadcasts = { broadcasts }
                        onBroadcastSelected
                            = { this._onYouTubeBroadcastIDSelected }
                        selectedBoundStreamID = { selectedBoundStreamID } />
                );
            } else {
                googleContent = (
                    <Spinner
                        isCompleting = { false }
                        size = 'medium' />
                );
            }

            /**
             * FIXME: Ideally this help text would be one translation string
             * that also accepts the anchor. This can be done using the Trans
             * component of react-i18next but I couldn't get it working...
             */
            helpText = (
                <div>
                    { `${t('liveStreaming.chooseCTA',
                        { email: _googleProfileEmail })} ` }
                    <a onClick = { this._onRequestGoogleSignIn }>
                        { t('liveStreaming.changeSignIn') }
                    </a>
                </div>
            );

            break;

        case GOOGLE_API_STATES.NEEDS_LOADING:
        default:
            googleContent = (
                <Spinner
                    isCompleting = { false }
                    size = 'medium' />
            );

            break;
        }

        if (this.state.errorType !== undefined) {
            googleContent = (
                <GoogleSignInButton
                    onClick = { this._onRequestGoogleSignIn } />
            );
            helpText = this._getGoogleErrorMessageToDisplay();
        }

        return (
            <div className = 'google-panel'>
                <div className = 'live-stream-cta'>
                    { helpText }
                </div>
                <div className = 'google-api'>
                    { googleContent }
                </div>
            </div>
        );
    }

    _setStateIfMounted: Object => void

    /**
     * Returns the error message to display for the current error state.
     *
     * @private
     * @returns {string} The error message to display.
     */
    _getGoogleErrorMessageToDisplay() {
        let text;

        switch (this.state.errorType) {
        case 'liveStreamingNotEnabled':
            text = this.props.t(
                'liveStreaming.errorLiveStreamNotEnabled',
                { email: this.props._googleProfileEmail });
            break;
        default:
            text = this.props.t('liveStreaming.errorAPI');
            break;
        }

        return <div className = 'google-error'>{ text }</div>;
    }
}

/**
 * Maps part of the Redux state to the component's props.
 *
 * @param {Object} state - The Redux state.
 * @returns {{
 *     _googleApiApplicationClientID: string
 * }}
*/
function _mapStateToProps(state: Object) {
    return {
        ..._abstractMapStateToProps(state),
        _googleApiApplicationClientID:
        state['features/base/config'].googleApiApplicationClientID
    };
}

export default translate(connect(_mapStateToProps)(StartLiveStreamDialog));
