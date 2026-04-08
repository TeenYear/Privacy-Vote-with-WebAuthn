import React, { useState, useEffect } from 'react';
import './App.css';
import { useWeb3ModalProvider } from '@web3modal/ethers/react';

import ConnectButton from './components/connectButton';
import MainForm from './components/mainForm';
import VoteForm from './components/voteForm';

import { ChakraProvider, Box, Flex } from '@chakra-ui/react';
import { API_URL } from './config';

const SESSION_KEY = 'privacy-vote-session-id';

const App: React.FC = () => {
  const { walletProvider } = useWeb3ModalProvider();

  const [username, setUsername] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isRoaming, setIsRoaming] = useState<boolean>(false);

  // On mount: detect server/chain restart and clear stale user data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/status`);
        const data = await res.json();
        const prevSession = window.localStorage.getItem(SESSION_KEY);
        if (prevSession && prevSession !== data.sessionId) {
          console.log(
            'Server restarted (session changed). Clearing local user data.',
          );
          window.localStorage.clear();
        }
        if (data.sessionId) {
          window.localStorage.setItem(SESSION_KEY, data.sessionId);
        }
      } catch {
        // Server not reachable; don't clear
      }
    })();
  }, []);

  return (
    <ChakraProvider>
      <Flex direction="column" minHeight="100vh" bg="gray.900">
        <Flex
          position="absolute"
          top="1rem"
          right="1rem"
          px={{ base: 2, md: 4 }}
        >
          <ConnectButton />
        </Flex>

        <Flex
          flex={1}
          direction="column"
          align="center"
          justify="center"
          px={{ base: 4, md: 8 }}
        >
          <Box
            p={{ base: 4, md: 8 }}
            mb={4}
            borderRadius="lg"
            boxShadow="lg"
            bg="gray.700"
            w={{ base: '90%', sm: '80%', md: 'lg' }}
          >
            <MainForm
              username={username}
              setUsername={setUsername}
              setIsAuthenticated={setIsAuthenticated}
              isAuthenticated={isAuthenticated}
              isRoaming={isRoaming}
              walletProvider={walletProvider}
            />
          </Box>
          <Box
            p={{ base: 4, md: 8 }}
            borderRadius="lg"
            boxShadow="lg"
            bg="gray.700"
            w={{ base: '95%', sm: '90%', md: '3xl' }}
          >
            <VoteForm username={username} />
          </Box>
        </Flex>
      </Flex>
    </ChakraProvider>
  );
};

export default App;
