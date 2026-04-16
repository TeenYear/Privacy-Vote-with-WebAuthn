import React, { useState, useEffect } from 'react';
import {
  Button,
  Text,
  VStack,
  Heading,
  Box,
  SimpleGrid,
  Checkbox,
  CircularProgress,
  Progress,
} from '@chakra-ui/react';

import {
  authenticateUser,
  generateProof,
} from '../utils/webAuthn';
import { toast } from 'react-toastify';

import { API_URL } from '../config';

const MAX_SELECTIONS = 1;

interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface VoteFormProps {
  username: string;
}
const VoteForm: React.FC<VoteFormProps> = ({ username }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // States for submission progress
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [submissionMessage, setSubmissionMessage] = useState<string>('');

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_URL}/results`);
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates);
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    }
  };

  // Fetch candidates when component mounts
  useEffect(() => {
    fetchCandidates();
    const interval = setInterval(fetchCandidates, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleCandidate = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(id);
      } else {
        toast.warning(`You can only select ${MAX_SELECTIONS} candidates.`);
      }
      return next;
    });
  };

  const submitVotes = async () => {
    setSubmissionMessage('');

    if (selectedIds.size !== MAX_SELECTIONS) {
      setSubmissionMessage(
        `Please select exactly ${MAX_SELECTIONS} candidates.`,
      );
      return;
    }

    // Authenticate user via WebAuthn
    const isAuthenticated = await authenticateUser(username);
    if (!isAuthenticated) {
      setSubmissionMessage('Please register and complete KYC first.');
      return;
    }

    setIsSubmitting(true);
    const ids = Array.from(selectedIds);

    try {
      for (let i = 0; i < ids.length; i++) {
        const candidateId = ids[i];
        const candidate = candidates.find((c) => c.id === candidateId);
        setProgress({
          current: i + 1,
          total: ids.length,
          name: candidate?.name || `Candidate #${candidateId}`,
        });
        // voteType = 1 (for) always
        await generateProof(null, username, candidateId, 1);
      }

      setSubmissionMessage('Vote submitted successfully!');
      toast.success('Vote submitted!');
      setSelectedIds(new Set());
      await fetchCandidates();
    } catch (error: any) {
      const msg = error?.message || 'An error occurred during voting';
      setSubmissionMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      setProgress({ current: 0, total: 0, name: '' });
    }
  };

  return (
    <VStack spacing={4} w="100%">
      <Heading size="lg" color="white">
        Vote for a Candidate
      </Heading>
      <Text color="gray.300" fontSize="sm">
        Select one candidate to vote for
      </Text>

      {candidates.length > 0 ? (
        <SimpleGrid columns={[1, 2]} spacing={3} w="100%">
          {candidates.map((c) => (
            <Box
              key={c.id}
              p={3}
              bg={selectedIds.has(c.id) ? 'blue.700' : 'gray.600'}
              borderRadius="md"
              cursor={isSubmitting ? 'not-allowed' : 'pointer'}
              onClick={() => !isSubmitting && toggleCandidate(c.id)}
              border="2px solid"
              borderColor={selectedIds.has(c.id) ? 'blue.400' : 'transparent'}
              _hover={!isSubmitting ? { borderColor: 'blue.300' } : {}}
              transition="all 0.2s"
            >
              <Checkbox
                isChecked={selectedIds.has(c.id)}
                isDisabled={isSubmitting}
                onChange={() => toggleCandidate(c.id)}
                colorScheme="blue"
              >
                <Text color="white" fontWeight="bold" fontSize="sm">
                  {c.name}
                </Text>
              </Checkbox>

            </Box>
          ))}
        </SimpleGrid>
      ) : (
        <Text color="gray.400">Loading candidates...</Text>
      )}



      <Button
        colorScheme="blue"
        onClick={submitVotes}
        isDisabled={isSubmitting || selectedIds.size !== MAX_SELECTIONS}
        w="100%"
      >
        Submit Vote
      </Button>

      {isSubmitting && (
        <Box w="100%" textAlign="center">
          <CircularProgress isIndeterminate color="blue.300" size="40px" />
          <Text color="white" mt={2}>
            Generating proof {progress.current}/{progress.total}:{' '}
            {progress.name}
          </Text>
          <Progress
            value={(progress.current / progress.total) * 100}
            colorScheme="blue"
            mt={2}
            borderRadius="md"
          />
        </Box>
      )}

      {submissionMessage && (
        <Text
          color={
            submissionMessage.includes('success') ? 'green.400' : 'red.400'
          }
        >
          {submissionMessage}
        </Text>
      )}
    </VStack>
  );
};

export default VoteForm;
