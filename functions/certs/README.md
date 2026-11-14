# Apple public root certificate

AppleRootCA-G3.cer is the public DER certificate downloaded from:
https://www.apple.com/certificateauthority/AppleRootCA-G3.cer

SHA-256: 63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179

This is a public trust anchor, not an app signing key. The Apple server library verifies the certificate chain and online revocation status before accepting JWS transactions. App Store private API keys must remain in Secret Manager.
