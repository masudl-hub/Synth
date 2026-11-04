import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { IconMicrophone } from '@tabler/icons-react';

interface MicPanelProps {
  isLive: boolean;
  onStart: () => void;
}

export const MicPanel: React.FC<MicPanelProps> = ({ isLive, onStart }) => (
  <HStack gap={3} align="center" justify="between" width="100%">
    <VStack gap={0}>
      <Text type="label">Microphone input</Text>
      <Text type="supporting" size="xsm">
        {isLive ? 'Listening. The visuals react to your environment.' : 'Enable the microphone to visualize outside sound.'}
      </Text>
    </VStack>
    {!isLive && <Button label="Enable mic" variant="primary" icon={<IconMicrophone />} onClick={onStart} />}
  </HStack>
);
