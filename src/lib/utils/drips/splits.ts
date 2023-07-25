import type { AddressSplit, ProjectSplit } from '$lib/components/splits/splits.svelte';
import GitProjectService from '../project/GitProjectService';
import { AddressDriverClient, Utils } from 'radicle-drips';
import { getSubgraphClient } from '../get-drips-clients';
import type { RepoDriverSplitReceiver } from '../metadata/types';
import assert from '$lib/utils/assert';

type RepresentationalSplit = AddressSplit | ProjectSplit;

/**
 * Fetch splits for a given user ID, and map to representational splits for the `Splits` component.
 * @param accountId The user ID to build representational splits for.
 * @returns Representational splits.
 */
export async function getRepresentationalSplitsForAccount(
  accountId: string,
  projectSplitsMeta: RepoDriverSplitReceiver[] = [],
) {
  const subgraph = getSubgraphClient();

  const splits = await subgraph.getSplitsConfigByAccountId(accountId);

  return await buildRepresentationalSplits(
    splits.map((s) => ({
      account: {
        accountId: s.accountId,
      },
      weight: Number(s.weight),
    })),
    projectSplitsMeta,
  );
}

/**
 * Map project splits to representational splits for the `Splits` component.
 * @param splits The GitProject splits to map.
 * @returns The mapped representational splits for `Splits` component.
 */
export async function buildRepresentationalSplits(
  splits: { account: { accountId: string }; weight: number }[],
  projectSplitsMeta: RepoDriverSplitReceiver[] = [],
): Promise<RepresentationalSplit[]> {
  const gitProjectService = await GitProjectService.new();

  const promises = splits.map((s) =>
    (async () => {
      const splitType = Utils.AccountId.getDriver(s.account.accountId);

      if (splitType === 'repo') {
        const matchingMetadata = projectSplitsMeta.find(
          (v) => v.account.accountId === s.account.accountId,
        );

        const project = await gitProjectService.getByAccountId(
          s.account.accountId,
          true,
          matchingMetadata?.source,
        );

        assert(project);

        return {
          type: 'project-split' as const,
          project,
          weight: s.weight,
        };
      } else {
        return {
          type: 'address-split' as const,
          address: AddressDriverClient.getUserAddress(s.account.accountId),
          weight: s.weight,
        };
      }
    })(),
  );

  return Promise.all(promises);
}