const { toArray, take, filter } = require('rxjs/operators');
const collectRepos = require('../collectRepos');
const collectIssues = require('./index');
const mockGithub = require('../../test/fixtures/mockGithub');
const repositoryIssues = require('../../test/fixtures/repositoryIssues');
const TestTransport = require('../../test/TestTransport');

describe('collectIssueReactions', () => {
  let source;
  let transport;

  /**
   * Create a source Observable for the test suite
   *
   * @returns {Observable} Test Observable
   */
  const createSource = () =>
    collectRepos().pipe(
      take(1),
      collectIssues(transport),
      filter(event => event.event === 'issueReaction'),
      toArray()
    );

  afterAll(mockGithub.afterAll);
  beforeAll(mockGithub.beforeAll);

  beforeEach(() => {
    mockGithub.beforeEach();
    transport = new TestTransport();
    source = createSource();
  });

  it('Collects repo issue reactions and passes as events', async () => {
    const results = await source.toPromise();

    expect(results.length).toEqual(1);

    expect(results).toMatchSnapshot();
  });

  it('Picks up from the last cursor', async () => {
    transport.mockLastEvent = { cursor: 'someCursor' };

    await source.toPromise();

    const requests = mockGithub.requests();

    const hasCursor = requests.some(
      request => request.variables.cursor === transport.mockLastEvent.cursor
    );

    expect(hasCursor).toEqual(true);
  });

  it('skips reaction requests when the last cursor exists', async () => {
    const issues = repositoryIssues.edges();

    transport.mockLastEvent = {
      // Phew, that's a long path
      cursor: issues[0].node.reactions.edges[0].cursor
    };

    await source.toPromise();

    const requests = mockGithub
      .requests()
      .filter(request => request.query.includes('repositoryIssueReactions'));

    // `issues.length`, total possible timeline fetches,
    // `- 1`, we're not fetching one b/c of the cursor
    expect(requests.length).toEqual(issues.length - 1);
  });
});
