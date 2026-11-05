import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { VStack } from '@astryxdesign/core/VStack';
import { IconDeviceAudioTape, IconMicrophone } from '@tabler/icons-react';

interface MicPanelProps {
  isLive: boolean;
  onStart: () => void;
  /** Back to the AI synth. */
  onBack: () => void;
}

export const MicPanel: React.FC<MicPanelProps> = ({ isLive, onStart, onBack }) => (
  <HStack gap={3} align="center" justify="between" width="100%">
    <VStack gap={0}>
      <Text type="label">Ambient sound</Text>
      <Text type="supporting" size="xsm">
        {isLive ? 'The visuals react to your environment.' : 'Allow the microphone to visualise the sound around you.'}
      </Text>
    </VStack>
    <HStack gap={2} align="center">
      {!isLive && <Button label="Allow microphone" tooltip="Ask the browser for the microphone" variant="primary" icon={<IconMicrophone />} onClick={onStart} />}
      <ToggleButton
        label={isLive ? 'Listening' : 'Ambient sound'}
        tooltip="Ambient sound is on. Click to go back to the AI synth"
        icon={<IconDeviceAudioTape />}
        isPressed
        onPressedChange={onBack}
      />
    </HStack>
  </HStack>
);
