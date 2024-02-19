import {nanoid} from 'nanoid';

export type Data = {offsetX: number; offsetY: number; endLine: boolean};

class RTCService {
    webSocket: WebSocket | null;
    peerConnection: RTCPeerConnection | null;
    id: string | null;
    makingOffer: boolean;
    ignoreOffer: boolean;
    status: string;
    drawFromPeer: ((data: Data) => void) | null;
    dataChannel: RTCDataChannel | null;

    constructor() {
        this.webSocket = null;
        this.peerConnection = null;
        this.id = null;
        this.makingOffer = false;
        this.ignoreOffer = false;
        this.status = 'idle';
        this.drawFromPeer = null;
        this.dataChannel = null;
    }

    /**
     * Create a new WebSocket connection to the server.
     */
    private createSocket = async () => {
        const socket = new WebSocket(
            // Use wss:// for secure connections to avoid mixed content errors
            // This is necessary when the app is deployed or tunnelled
            `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/socket`,
        );

        // Wait for the WebSocket connection to open
        await new Promise((resolve) => {
            socket.onopen = resolve;
        });

        return socket;
    };

    public onConnect = async () => {
        this.status = 'calling';
        this.id = nanoid();

        this.webSocket = await this.createSocket();

        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
                },
            ],
        });

        /**
         * Create a data channel to send text data between peers.
         */
        this.dataChannel = this.peerConnection.createDataChannel('canvasData');

        /**
         * Once the ICE candidate has been gathered, send it to the other peer.
         * The ICE candidate contains information about how to connect to the peer.
         */
        this.peerConnection.onicecandidate = ({candidate}) => {
            if (candidate && this.webSocket) {
                this.webSocket?.send(JSON.stringify({id: this.id, candidate}));
            }
        };

        /**
         * Send an offer to the other peer on initial setup or network changes.
         */

        this.peerConnection.onnegotiationneeded = () => {
            this.makeOffer();
        };

        /**
         * Handle changes to the ICE connection state to detect network disconnections.
         */
        this.peerConnection.oniceconnectionstatechange = () => {
            // If the connection failed, try to restart the ICE connection.
            // This will trigger the onnegotiationneeded event and create a new offer.
            if (this.peerConnection?.iceConnectionState === 'failed') {
                this.peerConnection.restartIce();
            }

            // If the connection is disconnected, update the status and clean up the resources
            if (this.peerConnection?.iceConnectionState === 'disconnected') {
                this.onDisconnect();
            }
        };

        /**
         * Set up the WebSocket message handler to receive signaling data from the other peer.
         */
        this.webSocket.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            // We got an offer or answer from the other peer
            if (data.description) {
                // To avoid race conditions when 2 peers send offers at the same time
                // We make one of the peers "polite"
                // The polite peer will rollback its local description and wait for the other peer to create an answer
                // We use ID comparison to mark one peer as polite and the other impolite consistently
                const polite = data.id.localeCompare(this.id) === 1;

                const offerCollision = data.description.type == 'offer' && (this.makingOffer || this.peerConnection?.signalingState !== 'stable');

                this.ignoreOffer = !polite && offerCollision;

                if (this.ignoreOffer) {
                    if (!this.makingOffer) {
                        // After ignoring polite offer, send a new offer to the other peer
                        // This makes sure offer is sent even if `onnegotiationneeded` is not triggered
                        this.makeOffer();
                    }

                    return;
                }

                if (offerCollision) {
                    await Promise.all([this.peerConnection?.setLocalDescription({type: 'rollback'}), this.peerConnection?.setRemoteDescription(data.description)]);
                } else {
                    await this.peerConnection?.setRemoteDescription(data.description);
                }

                // If we got an offer, create an answer and send it to the other peer
                if (data.description.type === 'offer') {
                    await this.peerConnection?.setLocalDescription(await this.peerConnection.createAnswer());

                    this.webSocket?.send(
                        JSON.stringify({
                            id: this.id,
                            description: this.peerConnection?.localDescription,
                        }),
                    );
                }
            }

            // We got an ICE candidate from the other peer, add it to the peer connection
            if (data.candidate) {
                try {
                    await this.peerConnection?.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (error) {
                    if (!this.ignoreOffer) {
                        console.error(error);
                    }
                }
            }
        };

        this.peerConnection.ontrack = (event: RTCTrackEvent) => {
            // const remoteStream = event.streams[0];

            this.status = 'in-progress';
        };

        /**
         * Receive text data from the other peer and store it in the state.
         */
        this.peerConnection.ondatachannel = ({channel}) => {
            if (channel.label === 'canvasData') {
                channel.onmessage = ({data}) => {
                    if (this.drawFromPeer) {
                        this.drawFromPeer(data);
                    }
                };
            }
        };
    };

    public onDataReceived = (drawFromPeer: (data: Data) => void) => {
        this.drawFromPeer = drawFromPeer;
    };

    public sendDrawing = (data: Data) => {
        this.dataChannel?.send(JSON.stringify(data));
    };

    private makeOffer = async () => {
        try {
            this.makingOffer = true;

            const offer = await this.peerConnection?.createOffer();

            await this.peerConnection?.setLocalDescription(offer);

            this.webSocket?.send(
                JSON.stringify({
                    id: this.id,
                    description: this.peerConnection?.localDescription,
                }),
            );
        } catch (error) {
            console.error(error);
        } finally {
            this.makingOffer = false;
        }
    };

    public onDisconnect = () => {
        this.webSocket?.close();
        this.peerConnection?.close();
        this.status = 'idle';
    };
}

export {RTCService};
